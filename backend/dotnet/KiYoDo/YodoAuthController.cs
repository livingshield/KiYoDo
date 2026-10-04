using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace KikiAI.KiYoDo
{
    public class YodoRegisterDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
    }

    public class YodoLoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; } = true;
    }

    public class YodoGoogleLoginDto
    {
        public string IdToken { get; set; } = string.Empty;
    }

    public class YodoChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class YodoUpdateProfileDto
    {
        public string? DisplayName { get; set; }
    }

    [ApiController]
    [Route("api/yodo/auth")]
    public class YodoAuthController : ControllerBase
    {
        private readonly YodoDbContext _db;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;

        public YodoAuthController(YodoDbContext db, IHttpClientFactory httpClientFactory, IConfiguration config)
        {
            _db = db;
            _httpClientFactory = httpClientFactory;
            _config = config;
        }

        private static object FormatUser(YodoUser u) => new
        {
            id = u.Id,
            email = u.Email,
            displayName = string.IsNullOrWhiteSpace(u.DisplayName) ? u.Email.Split('@')[0] : u.DisplayName,
            avatarUrl = u.AvatarUrl,
            hasPassword = !string.IsNullOrEmpty(u.PasswordHash),
            hasGoogle = !string.IsNullOrEmpty(u.GoogleId),
            createdAt = u.CreatedAt
        };

        // POST /api/yodo/auth/register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] YodoRegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { error = "Zadejte platný e-mail a heslo." });

            var email = dto.Email.Trim().ToLowerInvariant();
            if (!Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                return BadRequest(new { error = "Neplatný formát e-mailové adresy." });

            if (dto.Password.Length < 6)
                return BadRequest(new { error = "Heslo musí mít alespoň 6 znaků." });

            var existing = await _db.Users.AnyAsync(u => u.Email == email);
            if (existing)
                return BadRequest(new { error = "Uživatel s tímto e-mailem již existuje." });

            var displayName = string.IsNullOrWhiteSpace(dto.DisplayName)
                ? email.Split('@')[0]
                : dto.DisplayName.Trim();

            var user = new YodoUser
            {
                Email = email,
                DisplayName = displayName,
                PasswordHash = YodoAuthHelper.HashPassword(dto.Password),
                CreatedAt = DateTime.UtcNow,
                LastLoginAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            // Create initial default folder "Oblíbené"
            var defaultFolder = new YodoFolder
            {
                UserId = user.Id,
                Name = "Oblíbené",
                Comment = "Moje uložená videa a hudba",
                SortOrder = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Folders.Add(defaultFolder);
            await _db.SaveChangesAsync();

            var token = YodoAuthHelper.GenerateToken(user, 60);
            return Ok(new
            {
                success = true,
                token,
                user = FormatUser(user),
                message = "Registrace byla úspěšná."
            });
        }

        // POST /api/yodo/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] YodoLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { error = "Zadejte e-mail a heslo." });

            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
                return Unauthorized(new { error = "Nesprávný e-mail nebo heslo." });

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
            {
                var remainingMin = Math.Ceiling((user.LockedUntil.Value - DateTime.UtcNow).TotalMinutes);
                return StatusCode(429, new { error = $"Účet je dočasně uzamčen kvůli opakovaným neúspěšným pokusům. Zkuste to za {remainingMin} minut." });
            }

            if (string.IsNullOrEmpty(user.PasswordHash))
            {
                return Unauthorized(new { error = "Tento účet byl vytvořen přes Google. Přihlaste se prosím přes tlačítko Google." });
            }

            if (!YodoAuthHelper.VerifyPassword(dto.Password, user.PasswordHash))
            {
                user.FailedLogins++;
                if (user.FailedLogins >= 10)
                {
                    user.LockedUntil = DateTime.UtcNow.AddMinutes(30);
                }
                await _db.SaveChangesAsync();
                return Unauthorized(new { error = "Nesprávný e-mail nebo heslo." });
            }

            user.FailedLogins = 0;
            user.LockedUntil = null;
            user.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var days = dto.RememberMe ? 60 : 7;
            var token = YodoAuthHelper.GenerateToken(user, days);

            return Ok(new
            {
                success = true,
                token,
                user = FormatUser(user)
            });
        }

        // POST /api/yodo/auth/google
        [HttpPost("google")]
        public async Task<IActionResult> GoogleLogin([FromBody] YodoGoogleLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.IdToken))
                return BadRequest(new { error = "Chybí Google ID token." });

            try
            {
                var client = _httpClientFactory.CreateClient();
                var verifyUrl = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(dto.IdToken.Trim())}";
                var response = await client.GetAsync(verifyUrl);

                if (!response.IsSuccessStatusCode)
                {
                    return Unauthorized(new { error = "Neplatný nebo vypršelý Google token." });
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Validate audience if GoogleClientId configured
                var configuredClientId = _config["KiYoDo:GoogleClientId"] ?? _config["Authentication:Google:ClientId"];
                if (!string.IsNullOrWhiteSpace(configuredClientId) && root.TryGetProperty("aud", out var audProp))
                {
                    var aud = audProp.GetString();
                    if (!string.Equals(aud, configuredClientId, StringComparison.Ordinal))
                    {
                        // Audience mismatch
                        return Unauthorized(new { error = "Token neodpovídá této aplikaci." });
                    }
                }

                var googleId = root.TryGetProperty("sub", out var subProp) ? subProp.GetString() : null;
                var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString()?.Trim().ToLowerInvariant() : null;
                var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                var picture = root.TryGetProperty("picture", out var picProp) ? picProp.GetString() : null;

                if (string.IsNullOrEmpty(googleId) || string.IsNullOrEmpty(email))
                {
                    return BadRequest(new { error = "Z Google účtu se nepodařilo získat identifikační údaje." });
                }

                // 1. Search by GoogleId
                var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleId == googleId);

                // 2. If not found by GoogleId, search by email and link
                if (user == null)
                {
                    user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
                    if (user != null)
                    {
                        user.GoogleId = googleId;
                        if (string.IsNullOrEmpty(user.AvatarUrl) && !string.IsNullOrEmpty(picture))
                            user.AvatarUrl = picture;
                    }
                }

                // 3. If still null, create new user
                bool isNew = false;
                if (user == null)
                {
                    isNew = true;
                    user = new YodoUser
                    {
                        Email = email,
                        DisplayName = !string.IsNullOrWhiteSpace(name) ? name : email.Split('@')[0],
                        GoogleId = googleId,
                        AvatarUrl = picture,
                        PasswordHash = null,
                        CreatedAt = DateTime.UtcNow,
                        LastLoginAt = DateTime.UtcNow
                    };
                    _db.Users.Add(user);
                    await _db.SaveChangesAsync();

                    // Create default folder "Oblíbené"
                    var defaultFolder = new YodoFolder
                    {
                        UserId = user.Id,
                        Name = "Oblíbené",
                        Comment = "Moje uložená videa a hudba",
                        SortOrder = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.Folders.Add(defaultFolder);
                    await _db.SaveChangesAsync();
                }
                else
                {
                    user.LastLoginAt = DateTime.UtcNow;
                    if (!string.IsNullOrEmpty(picture) && string.IsNullOrEmpty(user.AvatarUrl))
                        user.AvatarUrl = picture;
                    await _db.SaveChangesAsync();
                }

                var token = YodoAuthHelper.GenerateToken(user, 60);
                return Ok(new
                {
                    success = true,
                    token,
                    user = FormatUser(user),
                    isNewUser = isNew
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Chyba při ověřování Google účtu: " + ex.Message });
            }
        }

        // GET /api/yodo/auth/me
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var user = await YodoAuthHelper.GetUserFromRequestAsync(_db, Request);
            if (user == null)
                return Unauthorized(new { error = "Neplatný nebo vypršelý token." });

            return Ok(new
            {
                success = true,
                user = FormatUser(user)
            });
        }

        // POST /api/yodo/auth/change-password
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] YodoChangePasswordDto dto)
        {
            var user = await YodoAuthHelper.GetUserFromRequestAsync(_db, Request);
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            if (dto.NewPassword.Length < 6)
                return BadRequest(new { error = "Nové heslo musí mít alespoň 6 znaků." });

            if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                if (string.IsNullOrEmpty(dto.CurrentPassword) || !YodoAuthHelper.VerifyPassword(dto.CurrentPassword, user.PasswordHash))
                {
                    return BadRequest(new { error = "Stávající heslo není správné." });
                }
            }

            user.PasswordHash = YodoAuthHelper.HashPassword(dto.NewPassword);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Heslo bylo úspěšně změněno." });
        }

        // POST /api/yodo/auth/update-profile
        [HttpPost("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] YodoUpdateProfileDto dto)
        {
            var user = await YodoAuthHelper.GetUserFromRequestAsync(_db, Request);
            if (user == null)
                return Unauthorized(new { error = "Přihlaste se prosím." });

            if (!string.IsNullOrWhiteSpace(dto.DisplayName))
            {
                user.DisplayName = dto.DisplayName.Trim();
                await _db.SaveChangesAsync();
            }

            return Ok(new { success = true, user = FormatUser(user) });
        }
    }
}
