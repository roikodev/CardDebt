import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/user/my-collection")({
  component: MyCollectionLayout,
})

function MyCollectionLayout() {
  return <Outlet />
}

