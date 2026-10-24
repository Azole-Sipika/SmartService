
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using SmartService.API.Models;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/account-profile")]
[Authorize(Roles = "CUSTOMER,MANAGER")]
public class AccountProfileController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;

    public AccountProfileController(
        AppDbContext context,
        IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    private async Task<User?> GetCurrentUser()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        ) ?? User.FindFirstValue("sub");

        if (!int.TryParse(userId, out int id))
            return null;

        return await _context.Users.FirstOrDefaultAsync(
            u => u.Id == id &&
                 u.IsActive &&
                 (u.Role == "CUSTOMER" || u.Role == "MANAGER")
        );
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var user = await GetCurrentUser();

        if (user == null)
            return Unauthorized(new
            {
                message = "Account not found or inactive."
            });

        return Ok(new
        {
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email,
            user.Role,
            user.JobTitle,
            user.IsActive,
            user.CreatedAt
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile(
        [FromBody] UpdateAccountProfileRequest request)
    {
        var user = await GetCurrentUser();

        if (user == null)
            return Unauthorized();

        var firstName = request.FirstName?.Trim();
        var lastName = request.LastName?.Trim();

        if (string.IsNullOrWhiteSpace(firstName) ||
            string.IsNullOrWhiteSpace(lastName))
        {
            return BadRequest(new
            {
                message = "First name and last name are required."
            });
        }

        if (firstName.Length > 100 || lastName.Length > 100)
        {
            return BadRequest(new
            {
                message = "Names cannot exceed 100 characters."
            });
        }

        user.FirstName = firstName;
        user.LastName = lastName;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Profile updated successfully.",
            user.Id,
            user.FirstName,
            user.LastName
        });
    }

    [HttpPut("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangeAccountPasswordRequest request)
    {
        var user = await GetCurrentUser();

        if (user == null)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new
            {
                message = "Both passwords are required."
            });
        }

        var verification = _passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.CurrentPassword
        );

        if (verification == PasswordVerificationResult.Failed)
        {
            return BadRequest(new
            {
                message = "Current password is incorrect."
            });
        }

        if (request.NewPassword.Length < 8 ||
            request.NewPassword.Length > 128)
        {
            return BadRequest(new
            {
                message = "New password must be between 8 and 128 characters."
            });
        }

        if (request.NewPassword != request.ConfirmPassword)
        {
            return BadRequest(new
            {
                message = "New passwords do not match."
            });
        }

        if (request.CurrentPassword == request.NewPassword)
        {
            return BadRequest(new
            {
                message = "Choose a different password."
            });
        }

        user.PasswordHash = _passwordHasher.HashPassword(
            user,
            request.NewPassword
        );

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Password changed successfully."
        });
    }
}

public class UpdateAccountProfileRequest
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;
}

public class ChangeAccountPasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;
}
