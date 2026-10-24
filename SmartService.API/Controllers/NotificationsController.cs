
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using System.Security.Claims;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    // Get the authenticated user's ID
    private int? GetCurrentUserId()
    {
        var id = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        ) ?? User.FindFirstValue("sub");

        return int.TryParse(id, out var userId)
            ? userId
            : null;
    }

    // GET: api/Notifications
    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized();

        var notifications = await _context.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId.Value)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new
            {
                n.Id,
                n.TicketId,
                n.Title,
                n.Message,
                n.Type,
                n.IsRead,
                n.CreatedAt
            })
            .ToListAsync();

        return Ok(notifications);
    }

    // GET: api/Notifications/unread-count
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized();

        var count = await _context.Notifications
            .CountAsync(n =>
                n.UserId == userId.Value &&
                !n.IsRead
            );

        return Ok(new { count });
    }

    // PUT: api/Notifications/5/read
    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized();

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n =>
                n.Id == id &&
                n.UserId == userId.Value
            );

        if (notification == null)
            return NotFound(new
            {
                message = "Notification not found."
            });

        notification.IsRead = true;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Notification marked as read."
        });
    }

    // PUT: api/Notifications/read-all
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized();

        await _context.Notifications
            .Where(n =>
                n.UserId == userId.Value &&
                !n.IsRead
            )
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(
                    n => n.IsRead,
                    true
                )
            );

        return Ok(new
        {
            message = "All notifications marked as read."
        });
    }
}
