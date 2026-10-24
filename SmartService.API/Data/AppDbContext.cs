
using Microsoft.EntityFrameworkCore;
using SmartService.API.Models;

namespace SmartService.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }

    public DbSet<Ticket> Tickets { get; set; }

    public DbSet<Comment> Comments { get; set; }

    public DbSet<TicketActivity> TicketActivities { get; set; }

    public DbSet<Notification> Notifications { get; set; }

    public DbSet<TicketAttachment> TicketAttachments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TicketAttachment>()
            .HasOne(a => a.Ticket)
            .WithMany()
            .HasForeignKey(a => a.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TicketAttachment>()
            .Property(a => a.FileName)
            .HasMaxLength(255);

        modelBuilder.Entity<TicketAttachment>()
            .Property(a => a.StoredFileName)
            .HasMaxLength(255);

        modelBuilder.Entity<TicketAttachment>()
            .Property(a => a.ContentType)
            .HasMaxLength(100);
    }
}
