using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;
namespace AIInterview.API.Services;
public class ResumeTextExtractor
{
    private const long MaxBytes = 10 * 1024 * 1024;
    public async Task<string> ExtractAsync(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw new InvalidOperationException("Please choose a CV file.");
        if (file.Length > MaxBytes) throw new InvalidOperationException("CV size must be 10 MB or less.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        await using var input = new MemoryStream();
        await file.CopyToAsync(input, ct);
        var bytes = input.ToArray();
        string text;
        switch (extension)
        {
            case ".txt":
                text = Encoding.UTF8.GetString(bytes);
                break;
            case ".pdf":
                if (bytes.Length < 5 || Encoding.ASCII.GetString(bytes, 0, 5) != "%PDF-")
                    throw new InvalidOperationException("The uploaded file is not a valid PDF.");
                using (var pdfStream = new MemoryStream(bytes))
                using (var pdf = PdfDocument.Open(pdfStream))
                    text = string.Join("\n", pdf.GetPages().Select(p => p.Text));
                break;
            case ".docx":
                if (bytes.Length < 2 || bytes[0] != 0x50 || bytes[1] != 0x4B)
                    throw new InvalidOperationException("The uploaded file is not a valid DOCX document.");
                using (var docStream = new MemoryStream(bytes))
                using (var doc = WordprocessingDocument.Open(docStream, false))
                    text = doc.MainDocumentPart?.Document.Body?.InnerText ?? "";
                break;
            default:
                throw new InvalidOperationException("Supported CV formats are PDF, DOCX and TXT.");
        }
        text = Regex.Replace(text, @"\s+", " ").Trim();
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidOperationException("No readable text was found. Scanned PDFs need OCR; please upload a text-based PDF or DOCX.");
        return text;
    }
}
