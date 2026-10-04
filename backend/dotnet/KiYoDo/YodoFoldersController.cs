using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KikiAI.KiYoDo
{
    public class CreateFolderDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Comment { get; set; }
    }

    public class UpdateFolderDto
    {
        public string? Name { get; set; }
        public string? Comment { get; set; }
        public int? SortOrder { get; set; }
    }

    public class AddFolderItemDto
    {
        public string Url { get; set; } = string.Empty;
        public string? VideoId { get; set; }
        public string? Platform { get; set; }
        public string? Title { get; set; }
        public string? Author { get; set; }
        public string? ThumbnailUrl { get; set; }
        public string? Duration { get; set; }
        public string? Note { get; set; }
    }

    public class UpdateFolderItemDto
    {
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
    }

    public class MoveItemDto
    {
        public int TargetFolderId { get; set; }
    }

    public class BatchMoveItemsDto
    {
        public List<int> ItemIds { get; set; } = new List<int>();
        public int TargetFolderId { get; set; }
    }

    public class BatchDeleteItemsDto
    {
        public List<int> ItemIds { get; set; } = new List<int>();
    }

    [ApiController]
    [Route("api/yodo/folders")]
    public class YodoFoldersController : ControllerBase
    {
        private readonly YodoDbContext _db;

        public YodoFoldersController(YodoDbContext db)
        {
            _db = db;
        }

        private async Task<YodoUser?> GetAuthUserAsync()
        {
            return await YodoAuthHelper.GetUserFromRequestAsync(_db, Request);
        }

        // GET /api/yodo/folders
        [HttpGet]
        public async Task<IActionResult> GetFolders()
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folders = await _db.Folders
                .Where(f => f.UserId == user.Id)
                .OrderBy(f => f.SortOrder)
                .ThenBy(f => f.CreatedAt)
                .Select(f => new
                {
                    id = f.Id,
                    name = f.Name,
                    comment = f.Comment,
                    sortOrder = f.SortOrder,
                    createdAt = f.CreatedAt,
                    updatedAt = f.UpdatedAt,
                    itemCount = _db.FolderItems.Count(i => i.FolderId == f.Id),
                    previewThumbnails = _db.FolderItems
                        .Where(i => i.FolderId == f.Id && !string.IsNullOrEmpty(i.ThumbnailUrl))
                        .OrderByDescending(i => i.AddedAt)
                        .Select(i => i.ThumbnailUrl)
                        .Take(4)
                        .ToList()
                })
                .ToListAsync();

            return Ok(new { success = true, folders });
        }

        // POST /api/yodo/folders
        [HttpPost]
        public async Task<IActionResult> CreateFolder([FromBody] CreateFolderDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { error = "Zadejte název záložky." });

            var name = dto.Name.Trim();
            if (name.Length > 200) name = name.Substring(0, 200);

            var count = await _db.Folders.CountAsync(f => f.UserId == user.Id);
            if (count >= 100)
                return BadRequest(new { error = "Byl dosažen limit 100 záložek." });

            var folder = new YodoFolder
            {
                UserId = user.Id,
                Name = name,
                Comment = dto.Comment?.Trim(),
                SortOrder = count,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Folders.Add(folder);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                folder = new
                {
                    id = folder.Id,
                    name = folder.Name,
                    comment = folder.Comment,
                    sortOrder = folder.SortOrder,
                    createdAt = folder.CreatedAt,
                    updatedAt = folder.UpdatedAt,
                    itemCount = 0,
                    previewThumbnails = new List<string>()
                }
            });
        }

        // PUT /api/yodo/folders/{id}
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateFolder(int id, [FromBody] UpdateFolderDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            if (!string.IsNullOrWhiteSpace(dto.Name))
            {
                var name = dto.Name.Trim();
                if (name.Length > 200) name = name.Substring(0, 200);
                folder.Name = name;
            }

            if (dto.Comment != null)
            {
                folder.Comment = dto.Comment.Trim();
            }

            if (dto.SortOrder.HasValue)
            {
                folder.SortOrder = dto.SortOrder.Value;
            }

            folder.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                folder = new
                {
                    id = folder.Id,
                    name = folder.Name,
                    comment = folder.Comment,
                    sortOrder = folder.SortOrder,
                    createdAt = folder.CreatedAt,
                    updatedAt = folder.UpdatedAt
                }
            });
        }

        // DELETE /api/yodo/folders/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteFolder(int id)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            _db.Folders.Remove(folder);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Záložka byla smazána." });
        }

        // GET /api/yodo/folders/{id}/items
        [HttpGet("{id:int}/items")]
        public async Task<IActionResult> GetFolderItems(int id)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            var items = await _db.FolderItems
                .Where(i => i.FolderId == id)
                .OrderBy(i => i.SortOrder)
                .ThenByDescending(i => i.AddedAt)
                .Select(i => new
                {
                    id = i.Id,
                    folderId = i.FolderId,
                    url = i.Url,
                    videoId = i.VideoId,
                    platform = i.Platform ?? "youtube",
                    title = i.Title ?? "Video",
                    author = i.Author,
                    thumbnailUrl = i.ThumbnailUrl,
                    duration = i.Duration,
                    note = i.Note,
                    sortOrder = i.SortOrder,
                    addedAt = i.AddedAt
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                folder = new
                {
                    id = folder.Id,
                    name = folder.Name,
                    comment = folder.Comment
                },
                items
            });
        }

        // POST /api/yodo/folders/{id}/items
        [HttpPost("{id:int}/items")]
        public async Task<IActionResult> AddItem(int id, [FromBody] AddFolderItemDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            if (string.IsNullOrWhiteSpace(dto.Url))
                return BadRequest(new { error = "Zadejte platnou URL adresu videa." });

            var url = dto.Url.Trim();

            // Check if already in this folder
            var existing = await _db.FolderItems.FirstOrDefaultAsync(i => i.FolderId == id && i.Url == url);
            if (existing != null)
            {
                // Update note if provided
                if (!string.IsNullOrWhiteSpace(dto.Note))
                {
                    existing.Note = dto.Note.Trim();
                    await _db.SaveChangesAsync();
                }
                return Ok(new
                {
                    success = true,
                    item = existing,
                    alreadyExisted = true,
                    message = "Toto video již v této záložce je."
                });
            }

            var count = await _db.FolderItems.CountAsync(i => i.FolderId == id);
            if (count >= 500)
                return BadRequest(new { error = "V této záložce je dosažen limit 500 videí." });

            var item = new YodoFolderItem
            {
                FolderId = id,
                Url = url,
                VideoId = dto.VideoId?.Trim(),
                Platform = string.IsNullOrWhiteSpace(dto.Platform) ? "youtube" : dto.Platform.Trim().ToLowerInvariant(),
                Title = string.IsNullOrWhiteSpace(dto.Title) ? "Video" : dto.Title.Trim(),
                Author = dto.Author?.Trim(),
                ThumbnailUrl = dto.ThumbnailUrl?.Trim(),
                Duration = dto.Duration?.Trim(),
                Note = dto.Note?.Trim(),
                SortOrder = count,
                AddedAt = DateTime.UtcNow
            };

            _db.FolderItems.Add(item);
            folder.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                item = new
                {
                    id = item.Id,
                    folderId = item.FolderId,
                    url = item.Url,
                    videoId = item.VideoId,
                    platform = item.Platform,
                    title = item.Title,
                    author = item.Author,
                    thumbnailUrl = item.ThumbnailUrl,
                    duration = item.Duration,
                    note = item.Note,
                    sortOrder = item.SortOrder,
                    addedAt = item.AddedAt
                }
            });
        }

        // DELETE /api/yodo/folders/{id}/items/{itemId}
        [HttpDelete("{id:int}/items/{itemId:int}")]
        public async Task<IActionResult> DeleteItem(int id, int itemId)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            var item = await _db.FolderItems.FirstOrDefaultAsync(i => i.Id == itemId && i.FolderId == id);
            if (item == null)
                return NotFound(new { error = "Položka nebyla nalezena." });

            _db.FolderItems.Remove(item);
            folder.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Odkaz byl ze záložky odebrán." });
        }

        // PUT /api/yodo/folders/{id}/items/{itemId}
        [HttpPut("{id:int}/items/{itemId:int}")]
        public async Task<IActionResult> UpdateItem(int id, int itemId, [FromBody] UpdateFolderItemDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            var item = await _db.FolderItems.FirstOrDefaultAsync(i => i.Id == itemId && i.FolderId == id);
            if (item == null)
                return NotFound(new { error = "Položka nebyla nalezena." });

            if (dto.Note != null)
                item.Note = dto.Note.Trim();

            if (dto.SortOrder.HasValue)
                item.SortOrder = dto.SortOrder.Value;

            await _db.SaveChangesAsync();
            return Ok(new { success = true, item });
        }

        // POST /api/yodo/folders/{id}/items/{itemId}/move
        [HttpPost("{id:int}/items/{itemId:int}/move")]
        public async Task<IActionResult> MoveItem(int id, int itemId, [FromBody] MoveItemDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            var sourceFolder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            var targetFolder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == dto.TargetFolderId && f.UserId == user.Id);

            if (sourceFolder == null || targetFolder == null)
                return NotFound(new { error = "Zdrojová nebo cílová záložka nebyla nalezena." });

            var item = await _db.FolderItems.FirstOrDefaultAsync(i => i.Id == itemId && i.FolderId == id);
            if (item == null)
                return NotFound(new { error = "Položka nebyla nalezena." });

            // Check if already in target folder
            var existsInTarget = await _db.FolderItems.AnyAsync(i => i.FolderId == dto.TargetFolderId && i.Url == item.Url);
            if (existsInTarget)
                return BadRequest(new { error = "Toto video se v cílové záložce již nachází." });

            item.FolderId = dto.TargetFolderId;
            item.AddedAt = DateTime.UtcNow;
            sourceFolder.UpdatedAt = DateTime.UtcNow;
            targetFolder.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { success = true, message = "Odkaz byl úspěšně přesunut." });
        }

        // POST /api/yodo/folders/{id}/items/batch-move
        [HttpPost("{id:int}/items/batch-move")]
        public async Task<IActionResult> BatchMoveItems(int id, [FromBody] BatchMoveItemsDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            if (dto.ItemIds == null || dto.ItemIds.Count == 0)
                return BadRequest(new { error = "Nebyly vybrány žádné položky k přesunu." });

            var sourceFolder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            var targetFolder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == dto.TargetFolderId && f.UserId == user.Id);

            if (sourceFolder == null || targetFolder == null)
                return NotFound(new { error = "Zdrojová nebo cílová záložka nebyla nalezena." });

            var itemsToMove = await _db.FolderItems
                .Where(i => i.FolderId == id && dto.ItemIds.Contains(i.Id))
                .ToListAsync();

            if (itemsToMove.Count == 0)
                return NotFound(new { error = "Žádné vybrané položky nebyly nalezeny." });

            var existingTargetUrls = await _db.FolderItems
                .Where(i => i.FolderId == dto.TargetFolderId)
                .Select(i => i.Url)
                .ToListAsync();

            var movedCount = 0;
            var skippedCount = 0;

            foreach (var item in itemsToMove)
            {
                if (existingTargetUrls.Contains(item.Url))
                {
                    skippedCount++;
                    continue;
                }

                item.FolderId = dto.TargetFolderId;
                item.AddedAt = DateTime.UtcNow;
                existingTargetUrls.Add(item.Url);
                movedCount++;
            }

            if (movedCount > 0)
            {
                sourceFolder.UpdatedAt = DateTime.UtcNow;
                targetFolder.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return Ok(new
            {
                success = true,
                movedCount,
                skippedCount,
                message = skippedCount > 0
                    ? $"Přesunuto {movedCount} položek (přeskočeno {skippedCount} již existujících)."
                    : $"Přesunuto {movedCount} položek."
            });
        }

        // POST /api/yodo/folders/{id}/items/batch-delete
        [HttpPost("{id:int}/items/batch-delete")]
        public async Task<IActionResult> BatchDeleteItems(int id, [FromBody] BatchDeleteItemsDto dto)
        {
            var user = await GetAuthUserAsync();
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            if (dto.ItemIds == null || dto.ItemIds.Count == 0)
                return BadRequest(new { error = "Nebyly vybrány žádné položky ke smazání." });

            var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == user.Id);
            if (folder == null)
                return NotFound(new { error = "Záložka nebyla nalezena." });

            var itemsToDelete = await _db.FolderItems
                .Where(i => i.FolderId == id && dto.ItemIds.Contains(i.Id))
                .ToListAsync();

            if (itemsToDelete.Count > 0)
            {
                _db.FolderItems.RemoveRange(itemsToDelete);
                folder.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return Ok(new
            {
                success = true,
                deletedCount = itemsToDelete.Count,
                message = $"Odebráno {itemsToDelete.Count} položek."
            });
        }

        // GET /api/yodo/folders/check-video?url={url}
        [HttpGet("check-video")]
        public async Task<IActionResult> CheckVideo([FromQuery] string url)
        {
            var user = await GetAuthUserAsync();
            if (user == null || string.IsNullOrWhiteSpace(url))
                return Ok(new { savedIn = new List<object>() });

            var trimmedUrl = url.Trim();
            var userFolderIds = await _db.Folders
                .Where(f => f.UserId == user.Id)
                .Select(f => f.Id)
                .ToListAsync();

            var savedInFolders = await _db.FolderItems
                .Where(i => userFolderIds.Contains(i.FolderId) && i.Url == trimmedUrl)
                .Join(_db.Folders, i => i.FolderId, f => f.Id, (i, f) => new
                {
                    folderId = f.Id,
                    folderName = f.Name,
                    itemId = i.Id,
                    note = i.Note
                })
                .ToListAsync();

            return Ok(new { savedIn = savedInFolders });
        }
    }
}
