using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using MediCareManager.API.Middleware;
using MediCareManager.Core.Interfaces.Repositories;
using MediCareManager.Core.Interfaces.Services;
using MediCareManager.Core.Services;
using MediCareManager.Core.Settings;
using MediCareManager.Infrastructure.Repositories;
using MediCareManager.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ----- Connexion DB (injectée telle quelle dans les repositories Dapper) -----
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddSingleton(connectionString);

// ----- Paramètres JWT (lus depuis appsettings, injectés dans Core) -----
var jwtSettings = new JwtSettings
{
    Key = builder.Configuration["Jwt:Key"]!,
    Issuer = builder.Configuration["Jwt:Issuer"]!,
    Audience = builder.Configuration["Jwt:Audience"]!,
    ExpiryHours = int.TryParse(builder.Configuration["Jwt:ExpiryHours"], out var h) ? h : 8
};
builder.Services.AddSingleton(jwtSettings);

// ----- DI : repositories -----
builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<IMedecinRepository, MedecinRepository>();
builder.Services.AddScoped<ISecretaireRepository, SecretaireRepository>();
builder.Services.AddScoped<IAdministrateurRepository, AdministrateurRepository>();
builder.Services.AddScoped<IRendezVousRepository, RendezVousRepository>();
builder.Services.AddScoped<IPaiementRepository, PaiementRepository>();
builder.Services.AddScoped<ISucursaleRepository, SucursaleRepository>();
builder.Services.AddScoped<ISpecialisationRepository, SpecialisationRepository>();
builder.Services.AddScoped<IAssuranceRepository, AssuranceRepository>();
builder.Services.AddScoped<ITypeMaladieRepository, TypeMaladieRepository>();
builder.Services.AddScoped<IStatsRepository, StatsRepository>();

// ----- DI : services métier -----
builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IMedecinService, MedecinService>();
builder.Services.AddScoped<ISecretaireService, SecretaireService>();
builder.Services.AddScoped<IRendezVousService, RendezVousService>();
builder.Services.AddScoped<IPaiementService, PaiementService>();
builder.Services.AddScoped<ISucursaleService, SucursaleService>();
builder.Services.AddScoped<ISpecialisationService, SpecialisationService>();
builder.Services.AddScoped<IAssuranceService, AssuranceService>();
builder.Services.AddScoped<ITypeMaladieService, TypeMaladieService>();
builder.Services.AddScoped<IAdminService, AdminService>();

// ----- Authentification JWT -----
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // On conserve les noms de claims tels quels ("role", "sub").
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            RoleClaimType = "role",
            NameClaimType = "sub",
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
// ----- Autorisation -----
// On ne configure pas de politique d'autorisation spécifique, on se contente d'utiliser les rôles définis dans le JWT.
builder.Services.AddAuthorization();

// ----- CORS pour Angular (localhost:4200) -----
builder.Services.AddCors(options => options.AddPolicy("Angular",
    p => p.WithOrigins("http://localhost:4200")
          .AllowAnyMethod()
          .AllowAnyHeader()
          .AllowCredentials()));

// ----- Contrôleurs + sérialisation JSON snake_case (alignée sur les modèles Angular) -----
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
        // Permet aux propriétés numériques (long) d'être lues depuis une chaîne JSON.
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "MediCare Manager API", Version = "v1" });

    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Saisir le token JWT (sans le préfixe « Bearer »).",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

// ----- Build & Run -----
var app = builder.Build();
// ----- Middleware -----
app.UseSwagger();
app.UseSwaggerUI();
// Traduction centralisée des exceptions métier en codes HTTP.
app.UseMiddleware<ExceptionHandlingMiddleware>();
// Redirection automatique vers HTTPS.
app.UseCors("Angular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
// ----- Run -----
app.Run();
