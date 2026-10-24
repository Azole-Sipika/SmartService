
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
[Route("api/employee-profile")]
[Authorize(Roles = "EMPLOYEE")]
public class EmployeeProfileController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;

    public EmployeeProfileController(
        AppDbContext context,
        IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    private async Task<User?> GetCurrentEmployee()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier
        ) ?? User.FindFirstValue("sub");

        if (!int.TryParse(userId, out int employeeId))
            return null;

        return await _context.Users.FirstOrDefaultAsync(
            u => u.Id == employeeId &&
                 u.Role == "EMPLOYEE" &&
                 u.IsActive
        );
    }

    // GET: api/employee-profile/me
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var employee = await GetCurrentEmployee();

        if (employee == null)
            return Unauthorized(new
            {
                message = "Employee account not found."
            });

        return Ok(new
        {
            employee.Id,
            EmployeeNumber = $"EMP-{employee.Id:D3}",
            employee.FirstName,
            employee.LastName,
            employee.Email,
            employee.Role,
            employee.JobTitle,
            employee.IsActive,
            employee.CreatedAt
        });
    }

    // PUT: api/employee-profile/me
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile(
        [FromBody] UpdateEmployeeProfileRequest request)
    {
        var employee = await GetCurrentEmployee();

        if (employee == null)
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

        employee.FirstName = firstName;
        employee.LastName = lastName;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Profile updated successfully.",
            employee.Id,
            employee.FirstName,
            employee.LastName
        });
    }

    // PUT: api/employee-profile/change-password
    [HttpPut("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangeEmployeePasswordRequest request)
    {
        var employee = await GetCurrentEmployee();

        if (employee == null)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new
            {
                message = "Both passwords are required."
            });
        }

        var passwordResult =
            _passwordHasher.VerifyHashedPassword(
                employee,
                employee.PasswordHash,
                request.CurrentPassword
            );

        if (passwordResult == PasswordVerificationResult.Failed)
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

        employee.PasswordHash =
            _passwordHasher.HashPassword(
                employee,
                request.NewPassword
            );

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Password changed successfully."
        });
    }
}

public class UpdateEmployeeProfileRequest
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;
}

public class ChangeEmployeePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;
}
