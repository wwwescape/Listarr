import { createBrowserRouter } from "react-router-dom";
import Root from "./components/Root";
import Bootstrap from "./components/Bootstrap";
import Setup from "./components/Setup";
import Login from "./components/Login";
import ProtectedLayout from "./components/ProtectedLayout";
import AppShell from "./AppShell";
import Lists from "./components/Lists";
import List from "./components/List";
import Homes from "./components/Homes";
import HomeDetail from "./components/Home";
import Users from "./components/Users";
import UserDetail from "./components/User";
import Settings from "./components/Settings";
import Stats from "./components/Stats";
import ShareTarget from "./components/ShareTarget";
import {
  listsCrumbs,
  listDetailCrumbs,
  homesCrumbs,
  homeDetailCrumbs,
  usersCrumbs,
  userDetailCrumbs,
  statsCrumbs,
  settingsCrumbs,
} from "./navigation/breadcrumbConfig";

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/", element: <Bootstrap /> },
      { path: "/setup", element: <Setup /> },
      { path: "/login", element: <Login /> },
      {
        element: <ProtectedLayout />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/lists", element: <Lists />, handle: { crumbs: listsCrumbs } },
              { path: "/list/:listId", element: <List />, handle: { crumbs: listDetailCrumbs } },
              { path: "/homes", element: <Homes />, handle: { crumbs: homesCrumbs } },
              { path: "/home/:homeId", element: <HomeDetail />, handle: { crumbs: homeDetailCrumbs } },
              { path: "/users", element: <Users />, handle: { crumbs: usersCrumbs } },
              { path: "/user/:userId", element: <UserDetail />, handle: { crumbs: userDetailCrumbs } },
              { path: "/settings", element: <Settings />, handle: { crumbs: settingsCrumbs } },
              { path: "/stats", element: <Stats />, handle: { crumbs: statsCrumbs } },
              { path: "/share-target", element: <ShareTarget /> },
            ],
          },
        ],
      },
    ],
  },
]);

export default router;
