using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace KikiAI.KiYoDo
{
    // KiYoDo user accounts, bookmark folders and saved video links (tables prefixed yodo_)
    public class YodoUser
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? PasswordHash { get; set; }
        public string? GoogleId { get; set; }
        public string? AvatarUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }
        public int FailedLogins { get; set; }
        public DateTime? LockedUntil { get; set; }
    }

    public class YodoFolder
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public int SortOrder { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public List<YodoFolderItem> Items { get; set; } = new();
    }

    public class YodoFolderItem
    {
        public int Id { get; set; }
        public int FolderId { get; set; }
        public string Url { get; set; } = string.Empty;
        public string? VideoId { get; set; }
        public string? Platform { get; set; }
        public string? Title { get; set; }
        public string? Author { get; set; }
        public string? ThumbnailUrl { get; set; }
        public string? Duration { get; set; }
        public string? Note { get; set; }
        public int SortOrder { get; set; }
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }

    public class YodoDbContext : DbContext
    {
        public YodoDbContext(DbContextOptions<YodoDbContext> options) : base(options) { }

        public DbSet<YodoUser> Users => Set<YodoUser>();
        public DbSet<YodoFolder> Folders => Set<YodoFolder>();
        public DbSet<YodoFolderItem> FolderItems => Set<YodoFolderItem>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<YodoUser>(e =>
            {
                e.ToTable("yodo_Users");
                e.HasKey(x => x.Id);
                e.Property(x => x.Email).HasMaxLength(256).IsRequired();
                e.Property(x => x.DisplayName).HasMaxLength(128);
                e.Property(x => x.PasswordHash).HasMaxLength(256);
                e.Property(x => x.GoogleId).HasMaxLength(128);
                e.Property(x => x.AvatarUrl).HasMaxLength(1024);
            });

            modelBuilder.Entity<YodoFolder>(e =>
            {
                e.ToTable("yodo_Folders");
                e.HasKey(x => x.Id);
                e.Property(x => x.Name).HasMaxLength(200).IsRequired();
                e.Property(x => x.Comment).HasMaxLength(2000);
                e.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.FolderId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<YodoFolderItem>(e =>
            {
                e.ToTable("yodo_FolderItems");
                e.HasKey(x => x.Id);
                e.Property(x => x.Url).HasMaxLength(1024).IsRequired();
                e.Property(x => x.VideoId).HasMaxLength(64);
                e.Property(x => x.Platform).HasMaxLength(32);
                e.Property(x => x.Title).HasMaxLength(500);
                e.Property(x => x.Author).HasMaxLength(256);
                e.Property(x => x.ThumbnailUrl).HasMaxLength(1024);
                e.Property(x => x.Duration).HasMaxLength(32);
                e.Property(x => x.Note).HasMaxLength(2000);
            });
        }
    }

    public static class YodoSchema
    {
        // Creates yodo_ tables on SQL Server if missing (same approach as dr_ / WonderBook tables)
        public static void EnsureTables(YodoDbContext db)
        {
            if (!db.Database.IsSqlServer())
            {
                db.Database.EnsureCreated();
                return;
            }

            db.Database.ExecuteSqlRaw(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'yodo_Users')
BEGIN
    CREATE TABLE yodo_Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(256) NOT NULL,
        DisplayName NVARCHAR(128) NOT NULL DEFAULT '',
        PasswordHash NVARCHAR(256) NULL,
        GoogleId NVARCHAR(128) NULL,
        AvatarUrl NVARCHAR(1024) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        LastLoginAt DATETIME2 NULL,
        FailedLogins INT NOT NULL DEFAULT 0,
        LockedUntil DATETIME2 NULL
    );
    CREATE UNIQUE INDEX UX_yodo_Users_Email ON yodo_Users(Email);
    CREATE UNIQUE INDEX UX_yodo_Users_GoogleId ON yodo_Users(GoogleId) WHERE GoogleId IS NOT NULL;
END");

            db.Database.ExecuteSqlRaw(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'yodo_Folders')
BEGIN
    CREATE TABLE yodo_Folders (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Comment NVARCHAR(2000) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_yodo_Folders_Users FOREIGN KEY (UserId) REFERENCES yodo_Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_yodo_Folders_UserId ON yodo_Folders(UserId);
END");

            db.Database.ExecuteSqlRaw(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'yodo_FolderItems')
BEGIN
    CREATE TABLE yodo_FolderItems (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        FolderId INT NOT NULL,
        Url NVARCHAR(1024) NOT NULL,
        VideoId NVARCHAR(64) NULL,
        Platform NVARCHAR(32) NULL,
        Title NVARCHAR(500) NULL,
        Author NVARCHAR(256) NULL,
        ThumbnailUrl NVARCHAR(1024) NULL,
        Duration NVARCHAR(32) NULL,
        Note NVARCHAR(2000) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        AddedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_yodo_FolderItems_Folders FOREIGN KEY (FolderId) REFERENCES yodo_Folders(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_yodo_FolderItems_FolderId ON yodo_FolderItems(FolderId);
END");
        }
    }
}
