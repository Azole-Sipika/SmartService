namespace SmartService.API.Models;

public class TicketActivity
{
    public int Id { get; set; }

    public string Action { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Ticket this activity belongs to
    public int TicketId { get; set; }

    public Ticket? Ticket { get; set; }

    // User who performed the action
    public int UserId { get; set; }

    public User? User { get; set; }
}