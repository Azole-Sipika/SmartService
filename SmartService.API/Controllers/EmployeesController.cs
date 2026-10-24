
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartService.API.Data;
using SmartService.API.Models;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "MANAGER")]
public class EmployeesController : ControllerBase
{
    private readonly AppDbContext _context;

    public EmployeesController(AppDbContext context)
    {
        _context = context;
    }

    // GET ALL EMPLOYEES
    [HttpGet]
    public async Task<IActionResult> GetEmployees()
    {
        var users = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "EMPLOYEE")
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .ToListAsync();

        var employees = users.Select(u => new
        {
            u.Id,
            EmployeeNumber = $"EMP-{u.Id:D3}",
            u.FirstName,
            u.LastName,
            u.Email,
            u.Role,
            u.JobTitle,
            u.IsActive,
            u.CreatedAt
        });

        return Ok(employees);
    }

    // UPDATE EMPLOYEE DETAILS AND POSITION
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateEmployee(
        int id,
        [FromBody] UpdateEmployeeRequest request)
    {
        var employee = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Id == id && u.Role == "EMPLOYEE");

        if (employee == null)
        {
            return NotFound(new
            {
                message = "Employee not found."
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _context.Users
            .AnyAsync(u =>
                u.Id != id &&
                u.Email.ToLower() == email);

        if (emailExists)
        {
            return BadRequest(new
            {
                message = "This email address is already in use."
            });
        }

        if (string.IsNullOrWhiteSpace(request.FirstName) ||
            string.IsNullOrWhiteSpace(request.LastName) ||
            string.IsNullOrWhiteSpace(request.JobTitle))
        {
            return BadRequest(new
            {
                message = "Name, surname and position are required."
            });
        }

        employee.FirstName = request.FirstName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.Email = email;
        employee.JobTitle = request.JobTitle.Trim();

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Employee updated successfully.",
            employee = new
            {
                employee.Id,
                EmployeeNumber = $"EMP-{employee.Id:D3}",
                employee.FirstName,
                employee.LastName,
                employee.Email,
                employee.Role,
                employee.JobTitle,
                employee.IsActive
            }
        });
    }

    // DEACTIVATE EMPLOYEE
    [HttpPut("{id:int}/deactivate")]
    public async Task<IActionResult> DeactivateEmployee(int id)
    {
        var employee = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Id == id && u.Role == "EMPLOYEE");

        if (employee == null)
        {
            return NotFound(new
            {
                message = "Employee not found."
            });
        }

        if (!employee.IsActive)
        {
            return BadRequest(new
            {
                message = "Employee is already deactivated."
            });
        }

        employee.IsActive = false;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Employee account deactivated successfully.",
            employeeId = employee.Id,
            isActive = employee.IsActive
        });
    }

    // REACTIVATE EMPLOYEE
    [HttpPut("{id:int}/activate")]
    public async Task<IActionResult> ActivateEmployee(int id)
    {
        var employee = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Id == id && u.Role == "EMPLOYEE");

        if (employee == null)
        {
            return NotFound(new
            {
                message = "Employee not found."
            });
        }

        if (employee.IsActive)
        {
            return BadRequest(new
            {
                message = "Employee is already active."
            });
        }

        employee.IsActive = true;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Employee account reactivated successfully.",
            employeeId = employee.Id,
            isActive = employee.IsActive
        });
    }
}
