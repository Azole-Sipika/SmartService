
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using SmartService.API.Models;
using System.Security.Claims;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public CommentsController(AppDbContext context)
    {
        _context = context;
    }

    // ADD COMMENT TO A TICKET
    [HttpPost("{ticketId}")]
    public async Task<IActionResult> AddComment(
        int ticketId,
        [FromBody] string message)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var currentUserId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        var canComment =
            ticket.CustomerId == currentUserId ||
            ticket.AssignedEmployeeId == currentUserId;

        if (!canComment)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            return BadRequest(new
            {
                message = "Comment cannot be empty."
            });
        }

        // Create comment
        var comment = new Comment
        {
            Message = message.Trim(),
            TicketId = ticketId,
            UserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Comments.Add(comment);

        // Record ticket activity
        var activity = new TicketActivity
        {
            Action = "COMMENT_ADDED",
            Description = "A comment was added to the ticket.",
            TicketId = ticketId,
            UserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.TicketActivities.Add(activity);

        // Notify the customer only when the assigned
        // employee adds a comment.
        // Do not notify customers about their own comments.
        var isAssignedEmployee =
            ticket.AssignedEmployeeId == currentUserId &&
            ticket.CustomerId != currentUserId;

        if (isAssignedEmployee)
        {
            var notification = new Notification
            {
                UserId = ticket.CustomerId,
                TicketId = ticket.Id,
                Title = $"New Comment on Ticket #{ticket.Id}",
                Message =
                    $"An employee added a new comment to your ticket: {ticket.Title}",
                Type = "COMMENT",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Notifications.Add(notification);
        }

        // Save comment, activity, and notification together
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Comment added successfully.",
            comment = new
            {
                comment.Id,
                comment.Message,
                comment.TicketId,
                comment.UserId,
                comment.CreatedAt
            }
        });
    }

    // GET ALL COMMENTS FOR A TICKET
    [HttpGet("{ticketId}")]
    public async Task<IActionResult> GetComments(int ticketId)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var currentUserId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        var canView =
            ticket.CustomerId == currentUserId ||
            ticket.AssignedEmployeeId == currentUserId;

        if (!canView)
        {
            return Forbid();
        }

        var comments = await _context.Comments
            .Where(c => c.TicketId == ticketId)
            .Include(c => c.User)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Message,
                c.CreatedAt,
                c.UserId,

                UserName = c.User != null
                    ? $"{c.User.FirstName} {c.User.LastName}"
                    : "Unknown",

                UserRole = c.User != null
                    ? c.User.Role
                    : "Unknown"
            })
            .ToListAsync();

        return Ok(comments);
    }
}
