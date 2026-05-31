import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/users-test")({
  component: UsersTestPage,
});

function UsersTestPage() {
  return (
    <div className="p-4">
      <h1>Users Test Page</h1>
      <p>If you see this, the route loading works!</p>
      <table>
        <tbody>
          <tr>
            <td>Test Row</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
