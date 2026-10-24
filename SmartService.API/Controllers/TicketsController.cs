
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
public class TicketsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TicketsController(AppDbContext context)
    {
        _context = context;
    }

    // =========================================================
    // CUSTOMER - CREATE TICKET
    // =========================================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpPost]
    public async Task<IActionResult> CreateTicket(
        [FromBody] Ticket ticket)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var customerId))
        {
            return Unauthorized();
        }

        ticket.Id = 0;
        ticket.CustomerId = customerId;
        ticket.AssignedEmployeeId = null;
        ticket.Status = "OPEN";
        ticket.CreatedAt = DateTime.UtcNow;
        ticket.UpdatedAt = DateTime.UtcNow;

        _context.Tickets.Add(ticket);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket created successfully.",
            ticket
        });
    }

    // =========================================================
    // CUSTOMER - GET THEIR TICKETS
    // =========================================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpGet]
    public async Task<IActionResult> GetTickets()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var customerId))
        {
            return Unauthorized();
        }

        var tickets = await _context.Tickets
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return Ok(tickets);
    }

    // =========================================================
    // CUSTOMER - GET ONE TICKET
    // =========================================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetTicket(int id)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var customerId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == id &&
                t.CustomerId == customerId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        return Ok(ticket);
    }

    // =========================================================
    // CUSTOMER - UPDATE TICKET
    // =========================================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateTicket(
        int id,
        [FromBody] Ticket updatedTicket)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var customerId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == id &&
                t.CustomerId == customerId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        ticket.Title = updatedTicket.Title;
        ticket.Description = updatedTicket.Description;
        ticket.Priority = updatedTicket.Priority;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket updated successfully.",
            ticket
        });
    }

    // =========================================================
    // CUSTOMER - DELETE TICKET
    // =========================================================

    [Authorize(Roles = "CUSTOMER")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteTicket(int id)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var customerId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == id &&
                t.CustomerId == customerId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        _context.Tickets.Remove(ticket);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket deleted successfully."
        });
    }

    // =========================================================
    // EMPLOYEE - ROLE TEST
    // =========================================================

    [Authorize(Roles = "EMPLOYEE")]
    [HttpGet("employee-test")]
    public IActionResult EmployeeTest()
    {
        return Ok(new
        {
            message = "Employee access granted."
        });
    }

    // =========================================================
    // MANAGER - GET ALL TICKETS
    // =========================================================

    [Authorize(Roles = "MANAGER")]
    [HttpGet("manager/all")]
    public async Task<IActionResult> GetAllTicketsForManager()
    {
        var tickets = await _context.Tickets
            .AsNoTracking()
            .Include(t => t.Customer)
            .Include(t => t.AssignedEmployee)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Description,
                t.Priority,
                t.Status,
                t.CreatedAt,
                t.UpdatedAt,
                t.CustomerId,

                CustomerName = t.Customer != null
                    ? t.Customer.FirstName + " " +
                      t.Customer.LastName
                    : "Unknown",

                CustomerEmail = t.Customer != null
                    ? t.Customer.Email
                    : "Unknown",

                t.AssignedEmployeeId,

                AssignedEmployeeName =
                    t.AssignedEmployee != null
                        ? t.AssignedEmployee.FirstName + " " +
                          t.AssignedEmployee.LastName
                        : null,

                // Helps managers identify tickets that
                // need reassignment.
                AssignedEmployeeIsActive =
                    t.AssignedEmployee != null
                        ? t.AssignedEmployee.IsActive
                        : (bool?)null
            })
            .ToListAsync();

        return Ok(tickets);
    }

    // =========================================================
    // MANAGER - ASSIGN OR REASSIGN TICKET
    // =========================================================

    [Authorize(Roles = "MANAGER")]
    [HttpPut("{id:int}/assign/{employeeId:int}")]
    public async Task<IActionResult> AssignTicket(
        int id,
        int employeeId)
    {
        // Identify the logged-in manager
        var managerUserId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(managerUserId, out var managerId))
        {
            return Unauthorized();
        }

        // Find the ticket
        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
        {
            return NotFound(new
            {
                message = "Ticket not found."
            });
        }

        // Find the employee
        var employee = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Id == employeeId &&
                u.Role == "EMPLOYEE"
            );

        if (employee == null)
        {
            return BadRequest(new
            {
                message =
                    "Employee not found or user is not an employee."
            });
        }

        // Do not assign tickets to inactive employees
        if (!employee.IsActive)
        {
            return BadRequest(new
            {
                message =
                    "Cannot assign tickets to a deactivated employee."
            });
        }

        // Do not assign a ticket to the same employee twice
        if (ticket.AssignedEmployeeId == employeeId)
        {
            return BadRequest(new
            {
                message =
                    "This ticket is already assigned to this employee."
            });
        }

        // Remember the previous employee
        var previousEmployeeId =
            ticket.AssignedEmployeeId;

        string? previousEmployeeName = null;

        if (previousEmployeeId.HasValue)
        {
            var previousEmployee = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u =>
                    u.Id == previousEmployeeId.Value
                );

            if (previousEmployee != null)
            {
                previousEmployeeName =
                    $"{previousEmployee.FirstName} " +
                    $"{previousEmployee.LastName}";
            }
        }

        // Update assignment
        ticket.AssignedEmployeeId = employee.Id;

        // Preserve the status of existing tickets,
        // except when assigning an OPEN ticket.
        if (ticket.Status == "OPEN")
        {
            ticket.Status = "IN_PROGRESS";
        }

        ticket.UpdatedAt = DateTime.UtcNow;

        bool isReassignment =
            previousEmployeeId.HasValue;

        // Record assignment or reassignment activity
        var assignmentActivity = new TicketActivity
        {
            Action = isReassignment
                ? "TICKET_REASSIGNED"
                : "TICKET_ASSIGNED",

            Description = isReassignment
                ? $"Ticket reassigned from " +
                  $"{previousEmployeeName ?? "Unknown employee"} " +
                  $"to {employee.FirstName} {employee.LastName}."
                : $"Ticket assigned to " +
                  $"{employee.FirstName} {employee.LastName}.",

            TicketId = ticket.Id,
            UserId = managerId,
            CreatedAt = DateTime.UtcNow
        };

        _context.TicketActivities.Add(
            assignmentActivity
        );

        // Save assignment and activity together
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = isReassignment
                ? "Ticket reassigned successfully."
                : "Ticket assigned successfully.",

            ticketId = ticket.Id,
            previousEmployeeId,
            previousEmployeeName,
            assignedEmployeeId = employee.Id,
            assignedEmployee =
                $"{employee.FirstName} {employee.LastName}",
            status = ticket.Status
        });
    }

    // =========================================================
    // EMPLOYEE - GET ASSIGNED TICKETS
    // =========================================================

    [Authorize(Roles = "EMPLOYEE")]
    [HttpGet("assigned")]
    public async Task<IActionResult> GetAssignedTickets()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var employeeId))
        {
            return Unauthorized();
        }

        var tickets = await _context.Tickets
            .Where(t =>
                t.AssignedEmployeeId == employeeId
            )
            .OrderByDescending(t => t.UpdatedAt)
            .ToListAsync();

        return Ok(tickets);
    }

    // =========================================================
    // EMPLOYEE - UPDATE TICKET STATUS
    // =========================================================

    [Authorize(Roles = "EMPLOYEE")]
    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateTicketStatus(
        int id,
        [FromBody] string status)
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        );

        if (!int.TryParse(userId, out var employeeId))
        {
            return Unauthorized();
        }

        var ticket = await _context.Tickets
            .FirstOrDefaultAsync(t =>
                t.Id == id &&
                t.AssignedEmployeeId == employeeId
            );

        if (ticket == null)
        {
            return NotFound(new
            {
                message =
                    "Ticket not found or is not assigned to you."
            });
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return BadRequest(new
            {
                message = "Ticket status is required."
            });
        }

        status = status.Trim().ToUpperInvariant();

        var allowedStatuses = new[]
        {
            "IN_PROGRESS",
            "RESOLVED"
        };

        if (!allowedStatuses.Contains(status))
        {
            return BadRequest(new
            {
                message =
                    "Invalid status. Use IN_PROGRESS or RESOLVED."
            });
        }

        if (ticket.Status == status)
        {
            return BadRequest(new
            {
                message = $"Ticket is already {status}."
            });
        }

        var oldStatus = ticket.Status;

        // Update ticket
        ticket.Status = status;
        ticket.UpdatedAt = DateTime.UtcNow;

        // Record status change
        var statusActivity = new TicketActivity
        {
            Action = "STATUS_CHANGED",
            Description =
                $"Status changed from {oldStatus} to {status}.",
            TicketId = ticket.Id,
            UserId = employeeId,
            CreatedAt = DateTime.UtcNow
        };

        _context.TicketActivities.Add(statusActivity);

        // Notify the customer
        var notification = new Notification
        {
            UserId = ticket.CustomerId,
            TicketId = ticket.Id,

            Title = status == "RESOLVED"
                ? $"Ticket #{ticket.Id} Resolved"
                : $"Ticket #{ticket.Id} Status Updated",

            Message = status == "RESOLVED"
                ? $"Your ticket '{ticket.Title}' has been resolved."
                : $"Your ticket '{ticket.Title}' is now in progress.",

            Type = "STATUS_CHANGED",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);

        // Save ticket, activity and notification together
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Ticket status updated successfully.",
            ticketId = ticket.Id,
            oldStatus,
            status = ticket.Status,
            updatedAt = ticket.UpdatedAt
        });
    }
}
