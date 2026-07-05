import React, { useState } from "react";
import axios from "axios";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createUser } from "../api/users";
import type { UserOut } from "../api/types";

interface CreateUserProps {
  onCreateUser: (user: UserOut | null) => void;
}

const CreateUser = ({ onCreateUser }: CreateUserProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleCreateUser = async () => {
    // Perform validation (e.g., password match)
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const newUser = await createUser({
        username,
        password,
        firstname: firstName,
        lastname: lastName,
      });
      localStorage.setItem("adminUser", JSON.stringify(newUser));
      onCreateUser(newUser);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        alert("That username is already taken — if this is your existing account, use the Login screen instead.");
        localStorage.setItem("adminUser", "true");
        onCreateUser(null);
      } else if (axios.isAxiosError(error) && error.response) {
        alert(error.response.data?.detail || "Failed to create user");
      } else {
        console.error("Error creating user:", error);
        alert("Failed to create user");
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 2, textAlign: "center" }}>
      <Typography variant="h4" gutterBottom>
        Create Admin User
      </Typography>
      <TextField
        sx={{ mb: 2 }}
        label="Username"
        variant="outlined"
        fullWidth
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        sx={{ mb: 2 }}
        label="Password"
        type="password"
        variant="outlined"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        sx={{ mb: 2 }}
        label="Confirm Password"
        type="password"
        variant="outlined"
        fullWidth
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <TextField
        sx={{ mb: 2 }}
        label="First Name"
        variant="outlined"
        fullWidth
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <TextField
        sx={{ mb: 2 }}
        label="Last Name"
        variant="outlined"
        fullWidth
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <Button
        sx={{ mt: 2 }}
        variant="contained"
        color="primary"
        onClick={handleCreateUser}
      >
        Create
      </Button>
    </Box>
  );
};

export default CreateUser;
