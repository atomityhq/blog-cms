package io.atomity.blogcms.auth.controller;

import io.atomity.blogcms.auth.dto.LoginRequest;
import io.atomity.blogcms.auth.dto.LoginResponse;
import io.atomity.blogcms.auth.service.AuthService;
import io.atomity.blogcms.shared.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest http) {
        return ApiResponse.ok(
                authService.login(request.email(), request.password(), clientKey(http)));
    }

    /**
     * Uses the direct peer address for rate limiting.
     * Forwarded headers are not trusted without a trusted-proxy configuration.
     */
    private static String clientKey(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}