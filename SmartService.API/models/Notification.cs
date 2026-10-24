namespace SmartService.API.Models;

public class Notification
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int TicketId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}