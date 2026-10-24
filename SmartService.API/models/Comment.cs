namespace SmartService.API.Models;

public class Comment
{
    public int Id { get; set; }

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Ticket this comment belongs to
    public int TicketId { get; set; }

    public Ticket? Ticket { get; set; }

    // User who wrote the comment
    public int UserId { get; set; }

    public User? User { get; set; }
}