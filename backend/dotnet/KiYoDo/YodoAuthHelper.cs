using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace KikiAI.KiYoDo
{
    public class YodoAuthClaims
    {
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }

    public static class YodoAuthHelper
    {
        private static string _secretKey = "KiYoDo_UserAuth_Secret_Key_Change_In_Production_Env!";
        private static byte[] _keyBytes = Encoding.UTF8.GetBytes(_secretKey);

        public static void Initialize(string? configuredSecret)
        {
            if (!string.IsNullOrWhiteSpace(configuredSecret))
            {
                _secretKey = configuredSecret;
                _keyBytes = Encoding.UTF8.GetBytes(_secretKey);
            }
        }

        public static string GenerateToken(YodoUser user, int daysValid = 60)
        {
            var issuedAt = DateTime.UtcNow;
            var expiresAt = issuedAt.AddDays(daysValid);
            var payload = $"{user.Id}|{user.Email}|{user.DisplayName}|{issuedAt.Ticks}|{expiresAt.Ticks}";

            using var hmac = new HMACSHA256(_keyBytes);
            var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
            var signature = Convert.ToBase64String(signatureBytes);

            var fullToken = $"{payload}|{signature}";
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(fullToken));
        }

        public static YodoAuthClaims? ValidateToken(string? rawToken)
        {
            if (string.IsNullOrWhiteSpace(rawToken)) return null;

            try
            {
                // Strip "Bearer " if present
                if (rawToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    rawToken = rawToken.Substring(7).Trim();
                }

                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(rawToken.Trim()));
                var parts = decoded.Split('|');
                if (parts.Length != 6) return null;

                var idStr = parts[0];
                var email = parts[1];
                var displayName = parts[2];
                var issuedTicksStr = parts[3];
                var expiresTicksStr = parts[4];
                var signature = parts[5];

                if (!int.TryParse(idStr, out var userId)) return null;
                if (!long.TryParse(issuedTicksStr, out var issuedTicks)) return null;
                if (!long.TryParse(expiresTicksStr, out var expiresTicks)) return null;

                var expiresAt = new DateTime(expiresTicks, DateTimeKind.Utc);
                if (DateTime.UtcNow > expiresAt) return null;

                var expectedPayload = $"{idStr}|{email}|{displayName}|{issuedTicksStr}|{expiresTicksStr}";
                using var hmac = new HMACSHA256(_keyBytes);
                var expectedSigBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(expectedPayload));
                var expectedSig = Convert.ToBase64String(expectedSigBytes);

                if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(signature),
                    Encoding.UTF8.GetBytes(expectedSig)))
                {
                    return null;
                }

                return new YodoAuthClaims
                {
                    UserId = userId,
                    Email = email,
                    DisplayName = displayName,
                    ExpiresAt = expiresAt
                };
            }
            catch
            {
                return null;
            }
        }

        public static string? ExtractToken(HttpRequest request)
        {
            if (request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                var val = authHeader.ToString().Trim();
                if (val.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    return val.Substring(7).Trim();
                }
                if (!string.IsNullOrEmpty(val)) return val;
            }

            if (request.Headers.TryGetValue("X-Yodo-Token", out var customHeader))
            {
                var val = customHeader.ToString().Trim();
                if (!string.IsNullOrEmpty(val)) return val;
            }

            return null;
        }

        public static async Task<YodoUser?> GetUserFromRequestAsync(YodoDbContext db, HttpRequest request)
        {
            var token = ExtractToken(request);
            if (string.IsNullOrEmpty(token)) return null;

            var claims = ValidateToken(token);
            if (claims == null) return null;

            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == claims.UserId);
            return user;
        }

        public static string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        public static bool VerifyPassword(string password, string? passwordHash)
        {
            if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(passwordHash)) return false;
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, passwordHash);
            }
            catch
            {
                return false;
            }
        }
    }
}
