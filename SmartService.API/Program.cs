
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartService.API.Data;
using SmartService.API.Models;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// =========================================================
// POSTGRESQL DATABASE CONNECTION
// =========================================================

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString(
            "DefaultConnection"
        )
    )
);

// =========================================================
// CONTROLLERS
// =========================================================

builder.Services.AddControllers();

// =========================================================
// CORS - ALLOW REACT FRONTEND
// =========================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// =========================================================
// PASSWORD HASHING
// =========================================================

builder.Services.AddScoped<
    IPasswordHasher<User>,
    PasswordHasher<User>
>();

// =========================================================
// JWT AUTHENTICATION
// =========================================================

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                ValidIssuer =
                    builder.Configuration["Jwt:Issuer"],

                ValidAudience =
                    builder.Configuration["Jwt:Audience"],

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            builder.Configuration["Jwt:Key"]!
                        )
                    )
            };

        // =================================================
        // VALIDATE ACTIVE ACCOUNT AND CURRENT ROLE
        // =================================================

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userIdValue = context.Principal?
                    .FindFirstValue(
                        ClaimTypes.NameIdentifier
                    )
                    ?? context.Principal?
                        .FindFirstValue("sub");

                if (!int.TryParse(
                    userIdValue,
                    out var userId
                ))
                {
                    context.Fail(
                        "Invalid user identity."
                    );
                    return;
                }

                var dbContext = context.HttpContext
                    .RequestServices
                    .GetRequiredService<AppDbContext>();

                var user = await dbContext.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        u => u.Id == userId
                    );

                if (user == null || !user.IsActive)
                {
                    context.Fail(
                        "Account is inactive or does not exist."
                    );
                    return;
                }

                var tokenRole = context.Principal?
                    .FindFirstValue(
                        ClaimTypes.Role
                    );

                if (tokenRole != user.Role)
                {
                    context.Fail(
                        "Account role has changed. " +
                        "Please log in again."
                    );
                    return;
                }
            }
        };
    });

// =========================================================
// AUTHORIZATION
// =========================================================

builder.Services.AddAuthorization();

// =========================================================
// OPENAPI
// =========================================================

builder.Services.AddOpenApi();

// =========================================================
// BUILD APPLICATION
// =========================================================

var app = builder.Build();

// =========================================================
// ONE-TIME ADMIN BOOTSTRAP
// =========================================================

if (args.Contains("--bootstrap-admin"))
{
    if (!app.Environment.IsDevelopment())
    {
        Console.Error.WriteLine(
            "Admin bootstrap is only enabled " +
            "in the Development environment."
        );

        return;
    }

    var adminEmail = Environment.GetEnvironmentVariable(
        "SMARTSERVICE_ADMIN_EMAIL"
    )?.Trim();

    var adminPassword = Environment.GetEnvironmentVariable(
        "SMARTSERVICE_ADMIN_PASSWORD"
    );

    var adminFirstName =
        Environment.GetEnvironmentVariable(
            "SMARTSERVICE_ADMIN_FIRSTNAME"
        )?.Trim();

    var adminLastName =
        Environment.GetEnvironmentVariable(
            "SMARTSERVICE_ADMIN_LASTNAME"
        )?.Trim();

    if (
        string.IsNullOrWhiteSpace(adminEmail) ||
        string.IsNullOrWhiteSpace(adminPassword) ||
        string.IsNullOrWhiteSpace(adminFirstName) ||
        string.IsNullOrWhiteSpace(adminLastName)
    )
    {
        Console.Error.WriteLine(
            "Admin setup requires these environment variables:"
        );

        Console.Error.WriteLine(
            "SMARTSERVICE_ADMIN_EMAIL"
        );

        Console.Error.WriteLine(
            "SMARTSERVICE_ADMIN_PASSWORD"
        );

        Console.Error.WriteLine(
            "SMARTSERVICE_ADMIN_FIRSTNAME"
        );

        Console.Error.WriteLine(
            "SMARTSERVICE_ADMIN_LASTNAME"
        );

        return;
    }

    if (
        !adminEmail.Contains('@') ||
        adminPassword.Length < 12
    )
    {
        Console.Error.WriteLine(
            "Enter a valid email and a password " +
            "containing at least 12 characters."
        );

        return;
    }

    using var scope = app.Services.CreateScope();

    var dbContext = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    var passwordHasher = scope.ServiceProvider
        .GetRequiredService<IPasswordHasher<User>>();

    // This setup creates only the first administrator.
    var adminExists = await dbContext.Users
        .AnyAsync(user => user.Role == "ADMIN");

    if (adminExists)
    {
        Console.WriteLine(
            "An Admin account already exists. " +
            "No changes were made."
        );

        return;
    }

    var emailExists = await dbContext.Users
        .AnyAsync(user =>
            user.Email.ToLower() ==
            adminEmail.ToLower()
        );

    if (emailExists)
    {
        Console.Error.WriteLine(
            "This email already belongs to another account. " +
            "Use a different Admin email."
        );

        return;
    }

    var admin = new User
    {
        FirstName = adminFirstName,
        LastName = adminLastName,
        Email = adminEmail,
        Role = "ADMIN",
        JobTitle = "System Administrator",
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    admin.PasswordHash =
        passwordHasher.HashPassword(
            admin,
            adminPassword
        );

    dbContext.Users.Add(admin);

    await dbContext.SaveChangesAsync();

    Console.WriteLine(
        "Initial Admin account created successfully."
    );

    Console.WriteLine(
        "You can now log in with the Admin credentials."
    );

    return;
}

// =========================================================
// HTTP REQUEST PIPELINE
// =========================================================

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("FrontendPolicy");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();
