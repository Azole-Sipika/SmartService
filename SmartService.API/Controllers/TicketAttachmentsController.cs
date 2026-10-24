
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using SmartService.API.Models;
using System.Security.Claims;

namespace SmartService.API.Controllers;

[ApiController]
[Authorize]
[Route("api/tickets/{ticketId:int}/attachments")]
public class TicketAttachmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly string _uploadDirectory;

    private const long MaxFileSize = 5 * 1024 * 1024;

    public TicketAttachmentsController(
        AppDbContext context,
        IWebHostEnvironment environment)
    {
        _context = context;

        _uploadDirectory = Path.Combine(
            environment.ContentRootPath,
            "PrivateUploads",
            "TicketAttachments"
        );
    }

    // ==========================================
    // GET CURRENT LOGGED-IN USER ID
    // ==========================================

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        return int.TryParse(claim, out var id)
            ? id
            : null;
    }

    // ==========================================
    // CHECK TICKET ACCESS PERMISSIONS
    // ==========================================

    private bool CanAccessTicket(
        Ticket ticket,
        int userId)
    {
        if (User.IsInRole("CUSTOMER"))
        {
            return ticket.CustomerId == userId;
        }

        if (User.IsInRole("EMPLOYEE"))
        {
            return ticket.AssignedEmployeeId == userId;
        }

        if (User.IsInRole("MANAGER"))
        {
            return true;
        }

        return false;
    }

    // ==========================================
    // ATTACHMENT RESPONSE
    // ==========================================

    private static object ToResponse(
        TicketAttachment attachment)
    {
        return new
        {
            attachment.Id,
            attachment.TicketId,
            attachment.UploadedByUserId,
            attachment.FileName,
            attachment.ContentType,
            attachment.FileSize,
            attachment.UploadedAt
        };
    }

    // ==========================================
    // CUSTOMER - UPLOAD ATTACHMENT
    // ==========================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxFileSize + 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment(
        int ticketId,
        [FromForm] IFormFile file)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == ticketId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        if (ticket.CustomerId != userId.Value)
        {
            return Forbid();
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new
            {
                message = "Please select a file."
            });
        }

        if (file.Length > MaxFileSize)
        {
            return BadRequest(new
            {
                message = "Maximum file size is 5 MB."
            });
        }

        // ======================================
        // VALIDATE FILE EXTENSION
        // ======================================

        var extension = Path.GetExtension(
            file.FileName
        ).ToLowerInvariant();

        var allowedExtensions = new[]
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".pdf"
        };

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new
            {
                message =
                    "Only JPG, JPEG, PNG and PDF files are allowed."
            });
        }

        // ======================================
        // VALIDATE ACTUAL FILE SIGNATURE
        // ======================================

        bool validSignature;

        using (var stream = file.OpenReadStream())
        {
            var header = new byte[8];

            var bytesRead = await stream.ReadAsync(
                header.AsMemory(0, header.Length)
            );

            validSignature = extension switch
            {
                ".jpg" or ".jpeg" =>
                    bytesRead >= 3 &&
                    header[0] == 0xFF &&
                    header[1] == 0xD8 &&
                    header[2] == 0xFF,

                ".png" =>
                    bytesRead >= 8 &&
                    header.SequenceEqual(new byte[]
                    {
                        0x89,
                        0x50,
                        0x4E,
                        0x47,
                        0x0D,
                        0x0A,
                        0x1A,
                        0x0A
                    }),

                ".pdf" =>
                    bytesRead >= 5 &&
                    header[0] == 0x25 &&
                    header[1] == 0x50 &&
                    header[2] == 0x44 &&
                    header[3] == 0x46 &&
                    header[4] == 0x2D,

                _ => false
            };
        }

        if (!validSignature)
        {
            return BadRequest(new
            {
                message =
                    "The file content does not match its extension."
            });
        }

        // ======================================
        // DETERMINE CONTENT TYPE
        // ======================================

        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };

        // ======================================
        // CREATE PRIVATE UPLOAD DIRECTORY
        // ======================================

        Directory.CreateDirectory(
            _uploadDirectory
        );

        // Never use the uploaded filename
        // as the physical storage filename.

        var storedFileName =
            $"{Guid.NewGuid():N}{extension}";

        var filePath = Path.Combine(
            _uploadDirectory,
            storedFileName
        );

        // ======================================
        // SAVE FILE AND DATABASE RECORD
        // ======================================

        try
        {
            await using (var fileStream =
                new FileStream(
                    filePath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None))
            {
                await file.CopyToAsync(fileStream);
            }

            var attachment = new TicketAttachment
            {
                TicketId = ticket.Id,

                UploadedByUserId = userId.Value,

                FileName = Path.GetFileName(
                    file.FileName
                ),

                StoredFileName = storedFileName,

                ContentType = contentType,

                FileSize = file.Length,

                UploadedAt = DateTime.UtcNow
            };

            _context.TicketAttachments.Add(
                attachment
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "File uploaded successfully.",

                attachment = ToResponse(
                    attachment
                )
            });
        }
        catch
        {
            // Remove the uploaded file if saving
            // the database record fails.

            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }

            throw;
        }
    }

    // ==========================================
    // CUSTOMER / EMPLOYEE / MANAGER
    // LIST TICKET ATTACHMENTS
    // ==========================================

    [Authorize(Roles = "CUSTOMER,EMPLOYEE,MANAGER")]
    [HttpGet]
    public async Task<IActionResult> GetAttachments(
        int ticketId)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.Id == ticketId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        // Fixed: no unnecessary await.
        if (!CanAccessTicket(
            ticket,
            userId.Value))
        {
            return Forbid();
        }

        var attachments =
            await _context.TicketAttachments
                .AsNoTracking()
                .Where(a =>
                    a.TicketId == ticketId
                )
                .OrderByDescending(a =>
                    a.UploadedAt
                )
                .ToListAsync();

        return Ok(
            attachments.Select(ToResponse)
        );
    }

    // ==========================================
    // CUSTOMER / EMPLOYEE / MANAGER
    // DOWNLOAD ATTACHMENT
    // ==========================================

    [Authorize(Roles = "CUSTOMER,EMPLOYEE,MANAGER")]
    [HttpGet("{attachmentId:int}")]
    public async Task<IActionResult> DownloadAttachment(
        int ticketId,
        int attachmentId)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.Id == ticketId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        // Fixed: synchronous permission check.
        if (!CanAccessTicket(
            ticket,
            userId.Value))
        {
            return Forbid();
        }

        var attachment =
            await _context.TicketAttachments
                .AsNoTracking()
                .FirstOrDefaultAsync(a =>
                    a.Id == attachmentId &&
                    a.TicketId == ticketId
                );

        if (attachment == null)
        {
            return NotFound(new
            {
                message = "Attachment not found."
            });
        }

        var filePath = Path.Combine(
            _uploadDirectory,
            attachment.StoredFileName
        );

        if (!System.IO.File.Exists(filePath))
        {
            return NotFound(new
            {
                message =
                    "Attachment file not found."
            });
        }

        return PhysicalFile(
            filePath,
            attachment.ContentType,
            attachment.FileName,
            enableRangeProcessing: true
        );
    }

    // ==========================================
    // CUSTOMER - DELETE OWN ATTACHMENT
    // ==========================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpDelete("{attachmentId:int}")]
    public async Task<IActionResult> DeleteAttachment(
        int ticketId,
        int attachmentId)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == ticketId &&
                t.CustomerId == userId.Value
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        var attachment =
            await _context.TicketAttachments
                .FirstOrDefaultAsync(a =>
                    a.Id == attachmentId &&
                    a.TicketId == ticketId &&
                    a.UploadedByUserId == userId.Value
                );

        if (attachment == null)
        {
            return NotFound(new
            {
                message = "Attachment not found."
            });
        }

        var filePath = Path.Combine(
            _uploadDirectory,
            attachment.StoredFileName
        );

        _context.TicketAttachments.Remove(
            attachment
        );

        await _context.SaveChangesAsync();

        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }

        return Ok(new
        {
            message =
                "Attachment deleted successfully."
        });
    }
}
