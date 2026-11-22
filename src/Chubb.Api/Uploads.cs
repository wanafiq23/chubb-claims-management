namespace Chubb.Api;

public static class Uploads
{
    public const int MaxSize = 5 * 1024 * 1024;
    public static async Task<List<ClaimDocument>> Read(IFormFileCollection files, Guid claimId, Guid? requestId, CancellationToken ct)
    {
        if (files.Count > 5) throw new ApiException(400, "At most five files per request.");
        var result = new List<ClaimDocument>();
        foreach (var file in files)
        {
            if (file.Length is <= 0 or > MaxSize) throw new ApiException(400, "Files must be nonempty and no larger than 5 MiB.");
            var name = Path.GetFileName(file.FileName.Replace('\\', '/'));
            if (string.IsNullOrWhiteSpace(name) || name.Length > 150 || name.Any(char.IsControl))
                throw new ApiException(400, "Invalid file name.");
            using var stream = new MemoryStream();
            await using var input = file.OpenReadStream();
            var buffer = new byte[81920];
            int count;
            while ((count = await input.ReadAsync(buffer, ct)) > 0)
            {
                if (stream.Length + count > MaxSize) throw new ApiException(400, "File exceeds 5 MiB.");
                await stream.WriteAsync(buffer.AsMemory(0, count), ct);
            }
            var data = stream.ToArray();
            var ext = Path.GetExtension(name).ToLowerInvariant();
            var valid = (ext, file.ContentType.ToLowerInvariant()) switch
            {
                (".pdf", "application/pdf") => data.AsSpan().StartsWith("%PDF-"u8),
                (".png", "image/png") => data.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                (".jpg" or ".jpeg", "image/jpeg") => data.AsSpan().StartsWith(new byte[] { 255, 216, 255 }),
                _ => false
            };
            if (!valid) throw new ApiException(400, "Only PDF, PNG and JPEG with matching extension, content type and signature are allowed.");
            result.Add(new ClaimDocument { ClaimId = claimId, InformationRequestId = requestId, FileName = name, ContentType = file.ContentType.ToLowerInvariant(), Content = data });
        }
        return result;
    }
}
