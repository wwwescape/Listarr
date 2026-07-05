import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateUser from "./CreateUser";
import { checkAdminExists } from "../api/users";

// Fresh-install entry point: create the first admin user, then go straight
// to /login. If an admin already exists (revisiting this URL post-install),
// redirect to /login instead of re-showing a form that's doomed to a
// duplicate-username error.
const Setup = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("adminUser")) {
      navigate("/login", { replace: true });
      return;
    }
    checkAdminExists()
      .then((exists) => {
        if (exists) {
          localStorage.setItem("adminUser", "true");
          navigate("/login", { replace: true });
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [navigate]);

  if (!checked) return null;
  return <CreateUser onCreateUser={() => navigate("/login", { replace: true })} />;
};

export default Setup;
