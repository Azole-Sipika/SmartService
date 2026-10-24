using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using System.Security.Claims;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TicketActivitiesController : ControllerBase
{
    private readonly AppDbContext _context;

    public TicketActivitiesController(AppDbContext context)
    {
        _context = context;
    }

    // GET ACTIVITY HISTORY FOR A TICKET
    [HttpGet("{ticketId}")]
    public async Task<IActionResult> GetTicketActivities(int ticketId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (userId == null)
        {
            return Unauthorized();
        }

        var currentUserId = int.Parse(userId);

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t => t.Id == ticketId);

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        // Customer who created the ticket,
        // assigned employee, or manager can view activity.
        var isCustomer = ticket.CustomerId == currentUserId;
        var isAssignedEmployee =
            ticket.AssignedEmployeeId == currentUserId;
        var isManager = User.IsInRole("MANAGER");

        if (!isCustomer && !isAssignedEmployee && !isManager)
        {
            return Forbid();
        }

        var activities = await _context.TicketActivities
            .Where(a => a.TicketId == ticketId)
            .Include(a => a.User)
            .OrderBy(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.Description,
                a.CreatedAt,
                a.UserId,

                UserName = a.User != null
                    ? $"{a.User.FirstName} {a.User.LastName}"
                    : "Unknown",

                UserRole = a.User != null
                    ? a.User.Role
                    : "Unknown"
            })
            .ToListAsync();

        return Ok(activities);
    }
}