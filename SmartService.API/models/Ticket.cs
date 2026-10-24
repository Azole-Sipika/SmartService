namespace SmartService.API.Models;

public class Ticket
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Priority { get; set; } = "MEDIUM";

    public string Status { get; set; } = "OPEN";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Customer who created the ticket
    public int CustomerId { get; set; }

    public User? Customer { get; set; }

    // Employee assigned to the ticket
    public int? AssignedEmployeeId { get; set; }

    public User? AssignedEmployee { get; set; }
}