import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button, TextField, Typography, Link, Container, Box, Alert } from "@mui/material";
import { isAuthenticated, login } from "../api/auth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/lists"); // Redirect to lists page if already logged in
    }
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await login(username, password);
      sessionStorage.removeItem("installPromptDismissed");
      navigate("/lists"); // Redirect to lists page
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(detail || "Failed to log in. Please try again.");
    }
  };

  const handleForgotPassword = () => {
    // Handle forgot password logic, e.g., navigate to forgot password page
    navigate("/forgot-password");
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Typography component="h1" variant="h5">
          Login
        </Typography>
        <Box component="form" noValidate onSubmit={handleLogin} sx={{ width: "100%", mt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ my: 2 }}
          >
            Login
          </Button>
          <Link href="#" variant="body2" sx={{ my: 1, display: "block" }} onClick={handleForgotPassword}>
            Forgot password?
          </Link>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
