
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartService.API.Data;
using SmartService.API.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SmartService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IConfiguration _configuration;

    public UsersController(
        AppDbContext context,
        IPasswordHasher<User> passwordHasher,
        IConfiguration configuration)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    // =========================================================
    // PUBLIC - REGISTER CUSTOMER
    // =========================================================

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterRequest request)
    {
        var email = request.Email?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new
            {
                message = "Email is required."
            });
        }

        var existingUser = await _context.Users
            .AnyAsync(u => u.Email == email);

        if (existingUser)
        {
            return BadRequest(new
            {
                message = "A user with this email already exists."
            });
        }

        var user = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = email,
            Role = "CUSTOMER"
        };

        user.PasswordHash = _passwordHasher.HashPassword(
            user,
            request.Password
        );

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "User registered successfully.",
            user = new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Role
            }
        });
    }

    // =========================================================
    // ADMIN - REGISTER EMPLOYEE
    // =========================================================

    [Authorize(Roles = "ADMIN")]
    [HttpPost("register-employee")]
    public async Task<IActionResult> RegisterEmployee(
        RegisterRequest request)
    {
        var email = request.Email?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new
            {
                message = "Email is required."
            });
        }

        var existingUser = await _context.Users
            .AnyAsync(u => u.Email == email);

        if (existingUser)
        {
            return BadRequest(new
            {
                message = "A user with this email already exists."
            });
        }

        if (string.IsNullOrWhiteSpace(request.JobTitle))
        {
            return BadRequest(new
            {
                message = "Please select an employee position."
            });
        }

        var employee = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = email,
            Role = "EMPLOYEE",
            JobTitle = request.JobTitle.Trim()
        };

        employee.PasswordHash =
            _passwordHasher.HashPassword(
                employee,
                request.Password
            );

        _context.Users.Add(employee);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Employee account created successfully.",
            employee = new
            {
                employee.Id,
                EmployeeNumber = $"EMP-{employee.Id:D3}",
                employee.FirstName,
                employee.LastName,
                employee.Email,
                employee.Role,
                employee.JobTitle
            }
        });
    }

    // =========================================================
    // ADMIN - REGISTER MANAGER
    // =========================================================

    [Authorize(Roles = "ADMIN")]
    [HttpPost("register-manager")]
    public async Task<IActionResult> RegisterManager(
        RegisterRequest request)
    {
        var email = request.Email?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new
            {
                message = "Email is required."
            });
        }

        var existingUser = await _context.Users
            .AnyAsync(u => u.Email == email);

        if (existingUser)
        {
            return BadRequest(new
            {
                message = "A user with this email already exists."
            });
        }

        var manager = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = email,
            Role = "MANAGER",
            JobTitle = "Manager"
        };

        manager.PasswordHash =
            _passwordHasher.HashPassword(
                manager,
                request.Password
            );

        _context.Users.Add(manager);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Manager account created successfully.",
            manager = new
            {
                manager.Id,
                EmployeeNumber = $"EMP-{manager.Id:D3}",
                manager.FirstName,
                manager.LastName,
                manager.Email,
                manager.Role,
                manager.JobTitle
            }
        });
    }

    // =========================================================
    // PUBLIC - LOGIN
    // =========================================================

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequest request)
    {
        var email = request.Email?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var passwordResult =
            _passwordHasher.VerifyHashedPassword(
                user,
                user.PasswordHash,
                request.Password
            );

        if (passwordResult ==
            PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new
            {
                message =
                    "Your account has been deactivated. " +
                    "Please contact an administrator."
            });
        }

        var claims = new[]
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.Id.ToString()
            ),
            new Claim(
                ClaimTypes.Email,
                user.Email
            ),
            new Claim(
                ClaimTypes.Name,
                $"{user.FirstName} {user.LastName}"
            ),
            new Claim(
                ClaimTypes.Role,
                user.Role
            )
        };

        var key = _configuration["Jwt:Key"]!;
        var issuer = _configuration["Jwt:Issuer"]!;
        var audience = _configuration["Jwt:Audience"]!;

        var securityKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(key)
        );

        var credentials = new SigningCredentials(
            securityKey,
            SecurityAlgorithms.HmacSha256
        );

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler()
            .WriteToken(token);

        return Ok(new
        {
            message = "Login successful.",
            token = tokenString,
            user = new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Role,
                user.JobTitle
            }
        });
    }

    // =========================================================
    // AUTHENTICATED USER - PROFILE
    // =========================================================

    [Authorize]
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        return Ok(new
        {
            message = "You are authenticated!",
            userId = User.FindFirstValue(
                ClaimTypes.NameIdentifier
            ),
            email = User.FindFirstValue(
                ClaimTypes.Email
            ),
            name = User.FindFirstValue(
                ClaimTypes.Name
            ),
            role = User.FindFirstValue(
                ClaimTypes.Role
            )
        });
    }

    // =========================================================
    // MANAGER / ADMIN - GET STAFF ACCOUNTS
    // =========================================================

    [Authorize(Roles = "MANAGER,ADMIN")]
    [HttpGet("employees")]
    public async Task<IActionResult> GetEmployees()
    {
        var employees = await _context.Users
            .Where(u =>
                u.Role == "EMPLOYEE" ||
                u.Role == "MANAGER")
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Select(u => new
            {
                u.Id,
                EmployeeNumber =
                    "EMP-" + u.Id.ToString().PadLeft(3, '0'),
                u.FirstName,
                u.LastName,
                u.Email,
                u.Role,
                u.JobTitle,
                u.IsActive
            })
            .ToListAsync();

        return Ok(employees);
    }
}
