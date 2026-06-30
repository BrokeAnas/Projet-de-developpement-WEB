using System.IdentityModel.Tokens.Jwt;
using MediCareManager.Core.DTOs;
using MediCareManager.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediCareManager.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>POST /api/auth/login — renvoie le token JWT ou HTTP 401.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var token = await _authService.LoginAsync(dto.Email, dto.Password);
        if (token is null)
            return Unauthorized(new { error = "Adresse e-mail ou mot de passe incorrect." });

        // On décode le JWT pour extraire les claims et les renvoyer dans la réponse.
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        // On définit une fonction locale pour extraire un claim par son type.
        string Claim(string type) => jwt.Claims.FirstOrDefault(c => c.Type == type)?.Value ?? string.Empty;

        // On construit la réponse avec le token et les informations de l'utilisateur.
        var response = new AuthResponseDto(
            Token: token,
            Role: Claim("role"),
            Nom: Claim("family_name"),
            Prenom: Claim("given_name"));
        // 
        return Ok(response);
    }
}
