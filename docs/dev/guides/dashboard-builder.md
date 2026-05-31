# Dashboard Builder Reference Guide

## Overview

This guide documents the shadcn-admin-1.0.0 dashboard template structure, components, and patterns. Use this as a reference when building dashboard features in our Journey Builder application.

The template is located in `docs/dev/code-examples/shadcn-admin-1.0.0/` and serves as a comprehensive reference for dashboard UI patterns, data tables, forms, charts, and layout systems.

Keep in mind that this example is for Next.js 15. We use TanStack Router for routing and TanStack Table for data tables. So we should keep in mind that we use the same version of TanStack and shadcn/ui.

# Live Version of the Example

- https://shadcnblocks-admin.vercel.app/

## Table of Contents

1. [Project Structure](#project-structure)
2. [Layout System](#layout-system)
3. [Dashboard Examples](#dashboard-examples)
4. [Data Tables](#data-tables)
5. [Forms & Settings](#forms--settings)
6. [Charts & Visualizations](#charts--visualizations)
7. [Common Components](#common-components)
8. [Patterns & Best Practices](#patterns--best-practices)

## Project Structure

### Key Directories

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/` - All dashboard pages organized by route groups
- `docs/dev/code-examples/dashboard/src/components/layout/` - Layout components (sidebar, header, navigation)
- `docs/dev/code-examples/dashboard/src/components/ui/` - shadcn/ui base components
- `docs/dev/code-examples/dashboard/src/components/` - Shared/common components
- `docs/dev/code-examples/dashboard/src/hooks/` - Custom React hooks
- `docs/dev/code-examples/dashboard/src/lib/` - Utility functions and helpers

### Route Organization

- `(auth)/` - Authentication pages (login, register, forgot-password)
- `(dashboard)/` - Main dashboard pages
  - `dashboard-2/` - Analytics dashboard example
  - `dashboard-3/` - Overview dashboard example
  - `(dashboard-1)/` - Board-style dashboard
  - `users/` - User management with data table
  - `tasks/` - Task management with data table
  - `settings/` - Settings pages (profile, billing, plans, etc.)
  - `developers/` - Developer tools (API keys, webhooks, logs)

## Layout System

### Dashboard Layout

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/layout.tsx`

- Uses `SidebarProvider` from shadcn/ui sidebar component
- Persists sidebar state in cookies (`sidebar:state`)
- Wraps all dashboard pages with sidebar and content area
- Provides responsive layout structure

**Key Features:**

- Cookie-based sidebar state persistence
- Responsive content area
- Fixed height support for full-screen layouts

### App Sidebar

**File:** `docs/dev/code-examples/dashboard/src/components/layout/app-sidebar.tsx`

**Structure:**

- `SidebarHeader` - Team switcher component
- `SidebarContent` - Navigation groups (rendered via NavGroup)
- `SidebarFooter` - User profile section (NavUser)
- `SidebarRail` - Visual indicator for collapse state

**Key Features:**

- Collapsible sidebar (icon mode when collapsed)
- Navigation groups with collapsible sub-items
- Active route highlighting
- Mobile-responsive with drawer behavior
- Uses shadcn/ui Sidebar primitives

### Sidebar Data Configuration

**File:** `docs/dev/code-examples/dashboard/src/components/layout/data/sidebar-data.tsx`

**Defines:**

- User information (name, email, avatar path)
- Teams/organizations array (with logos and plans)
- Navigation groups with hierarchical structure
- Icons from Tabler Icons and Lucide React

**Structure:**

```typescript
{
  user: { name, email, avatar },
  teams: [{ name, logo, plan }],
  navGroups: [
    {
      title: "Group Name",
      items: [
        {
          title: "Item",
          icon: IconComponent,
          url: "/path" | items: [{ title, url, icon }]
        }
      ]
    }
  ]
}
```

### Navigation Components

**NavGroup** (`docs/dev/code-examples/dashboard/src/components/layout/nav-group.tsx`)

- Renders navigation groups with collapsible items
- Handles active route detection
- Supports nested navigation items
- Mobile-aware (closes sidebar on navigation)
- Supports badges on nav items

**NavUser** (`docs/dev/code-examples/dashboard/src/components/layout/nav-user.tsx`)

- User profile section in sidebar footer
- Dropdown menu with:
  - Profile link
  - Billing link
  - Notifications link
  - Logout action
- Avatar display with fallback
- Responsive positioning (bottom on mobile, right on desktop)

**TeamSwitcher** (`docs/dev/code-examples/dashboard/src/components/layout/team-switcher.tsx`)

- Organization/team selector in sidebar header
- Dropdown menu with team list
- Keyboard shortcuts (⌘1, ⌘2, etc.)
- "Add team" option
- Logo display for each team

### Header Component

**File:** `docs/dev/code-examples/dashboard/src/components/layout/header.tsx`

**Features:**

- Sidebar trigger button (hamburger menu)
- Global search component (opens command menu)
- Theme switcher
- Sticky positioning (`sticky top-0`)
- Vertical separator for visual division

**Usage:**

- Import and use in dashboard pages
- Typically placed at top of page content
- Provides consistent navigation across dashboard

## Dashboard Examples

### Dashboard 2 (Analytics)

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/page.tsx`

**Layout Structure:**

- Header with title and actions
- Stats cards grid (6 columns, responsive)
- Revenue chart (full width, 6 columns)
- Recent activity table (8 columns on large screens)
- Visitors widget (4 columns on large screens)

**Components:**

- `stats.tsx` - Grid container for stat cards
- `stats-card.tsx` - Individual stat card with:
  - Icon in colored circle
  - Label
  - Large number display
  - Percentage change indicator (up/down)
  - Profit amount
  - "View Report" link
- `revenue-chart.tsx` - Bar chart with Recharts
- `recent-activity.tsx` - Activity feed table
- `visitors.tsx` - Visitor statistics pie chart
- `dashboard-2-actions.tsx` - Action buttons (Filter, Export)

**Grid System:**

- Uses 12-column grid (`grid-cols-6 lg:grid-cols-12`)
- Responsive column spans
- Consistent gap spacing (`gap-5`)

### Dashboard 3 (Overview)

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/page.tsx`

**Layout Structure:**

- Responsive 12-column grid
- Budget chart (8 columns on XL, full width on smaller)
- Visitors widget (4-6 columns responsive)
- Stats grid (4-5 columns responsive)
- Radar chart (4 columns)
- Stack bar chart (3 columns)

**Components:**

- `budget.tsx` - Budget visualization with toggle between desktop/mobile
- `radar-card.tsx` - Radar/spider chart for sales by month
- `stack-bar.tsx` - Stacked bar chart
- `visitors.tsx` - Visitor metrics pie chart
- `stats.tsx` - Stat cards grid
- `dashboard-3-actions.tsx` - Page action buttons

**Key Features:**

- Complex responsive grid layout
- Multiple chart types
- Interactive chart toggles
- Consistent card-based design

### Dashboard 1 (Boards)

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/(dashboard-1)/page.tsx`

Board-style dashboard with:

- Analytics board
- Overview board
- Kanban-style layouts
- Board-specific components in `boards/` subdirectory

## Data Tables

### Users Table Example

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/page.tsx`

**Complete Implementation Includes:**

- Breadcrumb navigation
- Page title and description
- Stats cards above table (UsersStats component)
- Primary actions (create, import, etc.)
- Full-featured data table with all TanStack Table features

**Page Structure:**

```tsx
<>
  <Breadcrumb />
  <h2>Page Title</h2>
  <UserPrimaryActions />
  <UsersStats />
  <UsersTable data={data} columns={columns} />
</>
```

### Table Component Structure

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-table.tsx`

**Uses TanStack Table with:**

- Row selection (checkboxes)
- Column visibility control
- Column filtering (text and faceted)
- Sorting (ascending/descending)
- Pagination

**State Management:**

- `rowSelection` - Selected rows object
- `columnVisibility` - Hidden columns state
- `columnFilters` - Active filters array
- `sorting` - Sort configuration array

**Table Features:**

- Sticky select column (left side)
- Responsive design
- Empty state handling
- Row selection state indicators

### Table Toolbar

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-toolbar.tsx`

**Features:**

- Search input (filters by email column)
- Faceted filters (status, role dropdowns)
- Reset filters button (shows when filters active)
- Column visibility toggle button

**Layout:**

- Flex layout with responsive stacking
- Search on left, filters in middle, view options on right
- Mobile-friendly (flex-col-reverse on small screens)

### Column Definitions

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-columns.tsx`

**Column Types:**

- **Select column** - Checkbox for row selection
- **Text columns** - Name, email with sorting
- **Date columns** - Formatted dates (createdAt, lastLoginAt)
- **Badge columns** - Status and role with color coding
- **Action column** - Row actions dropdown

**Column Features:**

- Custom cell renderers
- Sorting enabled/disabled per column
- Filter functions (weakEquals for badges)
- Column metadata (className for styling)
- Links to detail pages
- Icon support in cells

**Example Column:**

```tsx
{
  accessorKey: "status",
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Status" />
  ),
  cell: ({ row }) => {
    const badgeColor = callTypes.get(row.original.status)
    return <Badge className={badgeColor}>{row.getValue("status")}</Badge>
  },
  filterFn: "weakEquals",
  enableSorting: false,
}
```

### Column Header Component

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-column-header.tsx`

**Features:**

- Sortable columns show dropdown menu
- Sort indicators (up/down/caret icons)
- Sort options (Asc, Desc)
- Hide column option
- Non-sortable columns render as plain text

### Faceted Filter

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-faceted-filter.tsx`

**Multi-select Filter with:**

- Popover trigger button
- Command palette for selection
- Checkbox indicators for selected items
- Badge display of selected values
- Count badges for each option (shows how many rows match)
- Clear filters option
- Icon support for filter options

**Features:**

- Shows selected count on button
- Displays selected labels (or count if > 2)
- Search within filter options
- Responsive badge display

### Pagination

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-pagination.tsx`

**Features:**

- Rows per page selector (10, 20, 30, 40, 50)
- Page number display ("Page X of Y")
- First/previous/next/last buttons
- Selected row count display
- Responsive layout (hides some elements on mobile)
- Disabled states for navigation buttons

### Row Actions

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-row-actions.tsx`

**Dropdown Menu with:**

- View Detail (links to detail page)
- Edit (opens edit dialog)
- Deactivate (opens confirmation dialog)
- Icons for each action
- Keyboard shortcuts display

**Dialog Management:**

- Uses `useDialogState` hook
- Supports multiple dialog types
- Conditional rendering based on open state

### View Options

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-view-options.tsx`

**Column Visibility Toggle:**

- Dropdown menu with checkboxes
- Lists all hideable columns
- Toggle visibility per column
- Capitalized column names

### Primary Actions

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/user-primary-actions.tsx`

**Page-level Actions:**

- Invite User button
- Add User button
- Opens respective dialogs
- Uses dialog state management

### Data Schema

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/data/schema.ts`

**Uses Zod for:**

- Type-safe data validation
- Type inference
- Schema composition
- Union types for enums (status, role)

**Schema Structure:**

```typescript
const userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema, // Union of literals
  role: userRoleSchema, // Union of literals
  createdAt: z.coerce.date(),
  lastLoginAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
```

### Data Helpers

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/data/data.ts`

**Contains:**

- Status badge color mappings (Map)
- User type definitions with icons
- User stats data structure
- Helper functions for data transformation

### Stats Component

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-stats.tsx`

**Grid of Stat Cards Showing:**

- Total users
- New users
- Pending verifications
- Active users

**Each Card Includes:**

- Icon from Tabler Icons
- Title with tooltip (info icon)
- Large stat value
- Description text
- Card styling with hover effects

## Forms & Settings

### Settings Page Structure

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/settings/page.tsx`

**Uses ContentSection Wrapper:**

- Consistent page layout
- Title and description
- Form container with max-width
- Responsive design

### General Form Example

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/settings/components/general-form.tsx`

**Form Features:**

- React Hook Form integration
- Zod schema validation
- File upload (company logo with preview)
- Select dropdowns
- Text inputs
- Form sections with separators
- Action buttons (Save Changes, Delete Actions)
- Info banners (plan upgrade, account removal)

**Form Field Patterns:**

- Label + description on left
- Input/control on right
- Responsive flex layout (column on mobile, row on desktop)
- Icon badges for visual enhancement
- File preview for uploads
- Validation error messages

**Form Structure:**

```tsx
<Form {...form}>
  <InfoBanner />
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      name="field"
      render={({ field }) => (
        <FormItem className="flex flex-col md:flex-row md:items-center">
          <div>
            <FormLabel>Label</FormLabel>
            <FormDescription>Description</FormDescription>
          </div>
          <FormControl>
            <Input {...field} />
          </FormControl>
        </FormItem>
      )}
    />
    <Separator />
    <Button>Save Changes</Button>
  </form>
  <DeleteSection />
</Form>
```

### Form Components Used

- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormDescription`, `FormMessage`, `FormControl` from shadcn/ui
- `Input` for text inputs
- `Select` for dropdowns
- `Button` for actions
- `Badge` for icons/indicators
- `Separator` for visual division
- `Image` for file previews

## Charts & Visualizations

### Chart Components

All charts use Recharts library with shadcn/ui Chart wrapper components.

### Revenue Chart

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/revenue-chart.tsx`

**Features:**

- Grouped bar chart (desktop vs mobile)
- Chart config for color mapping
- Responsive container
- Legend display
- Custom tooltip
- X-axis with month abbreviation formatter
- Card wrapper with header
- Year selector dropdown
- Revenue amount display with trend badge

**Chart Structure:**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Revenue</CardTitle>
    <Select>Year selector</Select>
    <Revenue amount with badge />
  </CardHeader>
  <CardContent>
    <ResponsiveContainer>
      <ChartContainer config={chartConfig}>
        <BarChart>
          <ChartLegend />
          <CartesianGrid />
          <XAxis />
          <ChartTooltip />
          <Bar dataKey="desktop" />
          <Bar dataKey="mobile" />
        </BarChart>
      </ChartContainer>
    </ResponsiveContainer>
  </CardContent>
</Card>
```

### Visitors Chart

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/visitors.tsx`

**Features:**

- Pie chart with donut style (inner radius)
- Center label with total visitors
- Browser breakdown (Chrome, Safari, Firefox, Edge, Other)
- Color-coded segments
- Tooltip on hover
- Footer with trend information

### Budget Chart

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/budget.tsx`

**Features:**

- Bar chart with date range (3 months)
- Toggle between desktop and mobile views
- Interactive header buttons to switch data series
- Date formatter for X-axis
- Total display in header
- Responsive design

### Radar Chart

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/radar-card.tsx`

**Features:**

- Radar/spider chart
- Multiple data series (desktop, mobile)
- Month-based categories
- Polar grid
- Custom tooltip
- Card wrapper

### Stack Bar Chart

**File:** `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/stack-bar.tsx`

**Features:**

- Stacked bar chart
- Multiple categories (desktop, mobile)
- Color coding
- Legend display
- Month abbreviations on X-axis
- Rounded corners on bars

### Chart Patterns

**Common Patterns:**

1. **Chart Container Wrapper:**

   ```tsx
   <ChartContainer config={chartConfig}>
     <ChartComponent>{/* Chart elements */}</ChartComponent>
   </ChartContainer>
   ```

2. **Chart Config:**

   ```typescript
   const chartConfig = {
     desktop: {
       label: "Desktop",
       color: "var(--chart-1)",
     },
     mobile: {
       label: "Mobile",
       color: "var(--chart-2)",
     },
   } satisfies ChartConfig;
   ```

3. **Card Wrapper:**
   - All charts wrapped in Card component
   - CardHeader with title and controls
   - CardContent with chart
   - CardFooter for additional info (optional)

4. **Tooltip:**
   - Use `ChartTooltip` with `ChartTooltipContent`
   - Custom label formatters
   - Hide label option
   - Indicator styles (dashed, line)

5. **Responsive:**
   - Use `ResponsiveContainer` from Recharts
   - Set height constraints
   - Use aspect ratios for consistent sizing

## Common Components

### Search Component

**File:** `docs/dev/code-examples/dashboard/src/components/search.tsx`

**Features:**

- Command palette trigger button
- Keyboard shortcut display (⌘K)
- Search provider context integration
- Responsive width (w-full on mobile, fixed on desktop)
- Placeholder text customization

**Usage:**

- Place in header or navigation
- Opens global command menu
- Provides quick navigation

### Command Menu

**File:** `docs/dev/code-examples/dashboard/src/components/command-menu.tsx`

**Global Command Palette for:**

- Quick navigation (all routes from sidebar)
- Search functionality
- Keyboard shortcuts
- Theme switching

**Features:**

- Modal dialog
- Search input
- Grouped navigation items
- Theme switcher section
- Scroll area for long lists
- Empty state handling

### Date Pickers

- `date-picker.tsx` - Single date picker
- `date-range-picker.tsx` - Date range picker
- `calendar-date-picker.tsx` - Calendar component

### Other Common Components

**Back Button** (`back-button.tsx`)

- Navigation back button
- Consistent styling
- Icon support

**Copy Button** (`copy-button.tsx`)

- Copy to clipboard functionality
- Toast notification on success
- Icon button

**Confirm Dialog** (`confirm-dialog.tsx`)

- Reusable confirmation dialog
- Customizable message
- Action buttons

**Long Text** (`long-text.tsx`)

- Text truncation with tooltip
- Ellipsis handling
- Max width constraint

**Password Input** (`password-input.tsx`)

- Password field with visibility toggle
- Eye icon toggle
- Secure input handling

### Error Pages

**Directory:** `docs/dev/code-examples/dashboard/src/components/errors/`

**Error Components:**

- `forbidden.tsx` - 403 Forbidden error
- `general-error.tsx` - Generic 500 error
- `maintenance-error.tsx` - 503 Maintenance error
- `not-found-error.tsx` - 404 Not Found error
- `unauthorized-error.tsx` - 401 Unauthorized error

**Features:**

- Consistent error page design
- Error code display
- Message and description
- Action buttons (go home, retry)
- Illustration support

### Hooks

**use-dialog-state.tsx**

- Custom hook for dialog state management
- Supports multiple dialog types
- Toggle behavior (opens if closed, closes if open)
- Type-safe with generics

**Usage:**

```tsx
const [open, setOpen] = useDialogState<"edit" | "delete">(null);
// open: "edit" | "delete" | null
// setOpen("edit") - toggles edit dialog
```

**use-mobile.tsx**

- Detects mobile viewport
- Returns boolean
- Uses media query

**use-toast.ts**

- Toast notification hook
- From shadcn/ui
- Success/error/info variants

## Patterns & Best Practices

### File Organization

**1. Page Files (`page.tsx`)**

- Server components (Next.js)
- Compose page from smaller components
- Data fetching
- Layout structure

**2. Component Directory (`components/`)**

- Page-specific components
- Co-located with page
- Reusable within page context

**3. Data Directory (`data/`)**

- Data fetching functions
- Zod schemas
- Mock data
- Data transformation helpers

**4. Layout Files (`layout.tsx`)**

- Route group layouts
- Shared layout structure
- Providers

### Component Patterns

**Stat Cards:**

- Icon + label in header
- Large number display
- Trend indicator (up/down with percentage)
- Optional description
- Card wrapper
- Hover effects

**Action Buttons:**

- Primary actions in page header (top right)
- Row actions in dropdown menus (last column)
- Consistent button variants
- Icon support
- Dialog triggers

**Data Tables:**

- Toolbar above table (filters, search, view options)
- Table with sorting/filtering
- Pagination below table
- Row actions in last column
- Empty state handling
- Loading states

**Forms:**

- Use React Hook Form + Zod
- Consistent field layout (label + description on left, input on right)
- Form sections separated by Separator
- Save button at bottom
- Info banners for important information
- Validation error messages
- File upload with preview

**Charts:**

- Wrap in Card component
- ChartContainer for theming
- Chart config for colors
- Responsive containers
- Tooltips and legends
- Header with title and controls

### Styling Patterns

**Tailwind CSS:**

- Utility classes throughout
- Responsive breakpoints (sm, md, lg, xl, 2xl)
- Consistent spacing scale
- Color system (background, foreground, muted, etc.)

**Responsive Design:**

- Mobile-first approach
- Breakpoint-based layouts
- Flex and grid for layouts
- Hidden/visible utilities

**Grid Layouts:**

- 12-column grid system
- Responsive column spans
- Consistent gap spacing (`gap-4`, `gap-5`)
- Auto-rows for flexible heights

**Spacing:**

- Consistent padding (`p-4`, `px-6`, `py-4`)
- Gap spacing (`gap-2`, `gap-4`)
- Margin utilities (`mb-4`, `mt-2`)

**Cards:**

- Card component wrapper
- CardHeader, CardContent, CardFooter
- Consistent padding
- Border and shadow

### State Management

**React State:**

- Component-level state with useState
- Dialog state with useDialogState hook
- Form state with React Hook Form

**URL State:**

- Filters and sorting in URL (Next.js)
- Shareable URLs
- Browser back/forward support

**Cookies:**

- Sidebar state persistence
- User preferences
- Theme preference

**TanStack Table:**

- Table state (sorting, filtering, pagination)
- Row selection
- Column visibility
- Managed by useReactTable hook

### Type Safety

**Zod Schemas:**

- Data validation
- Type inference
- Runtime type checking
- Schema composition

**TypeScript:**

- Strict type checking
- Type inference from Zod
- Generic types for reusable components
- Type-safe form handling

**Column Definitions:**

- Typed with TanStack Table
- ColumnDef<User>[] format
- Type-safe cell renderers
- Meta types for column configuration

### Accessibility

**ARIA Labels:**

- aria-label on interactive elements
- sr-only classes for screen readers
- Semantic HTML structure

**Keyboard Navigation:**

- Tab order
- Keyboard shortcuts (⌘K for search)
- Focus management
- Escape to close dialogs

**Screen Readers:**

- sr-only text for context
- Alt text for images
- Descriptive button labels
- Form label associations

**Semantic HTML:**

- Proper heading hierarchy
- Button vs link usage
- Form elements properly labeled
- Table structure

## Key Files Reference

### Layout & Navigation

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/layout.tsx` - Dashboard layout wrapper
- `docs/dev/code-examples/dashboard/src/components/layout/app-sidebar.tsx` - Main sidebar component
- `docs/dev/code-examples/dashboard/src/components/layout/data/sidebar-data.tsx` - Sidebar configuration
- `docs/dev/code-examples/dashboard/src/components/layout/header.tsx` - Page header
- `docs/dev/code-examples/dashboard/src/components/layout/nav-group.tsx` - Navigation group renderer
- `docs/dev/code-examples/dashboard/src/components/layout/nav-user.tsx` - User profile in sidebar
- `docs/dev/code-examples/dashboard/src/components/layout/team-switcher.tsx` - Team selector
- `docs/dev/code-examples/dashboard/src/components/layout/types.ts` - Navigation type definitions

### Dashboard Examples

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/page.tsx` - Analytics dashboard
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/page.tsx` - Overview dashboard
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/stats-card.tsx` - Stat card pattern
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/revenue-chart.tsx` - Chart example
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/recent-activity.tsx` - Activity table
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/visitors.tsx` - Pie chart example

### Data Tables

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/page.tsx` - Complete table page example
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-table.tsx` - Table implementation
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-columns.tsx` - Column definitions
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-toolbar.tsx` - Table toolbar
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-faceted-filter.tsx` - Filter component
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-pagination.tsx` - Pagination
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-column-header.tsx` - Sortable header
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-row-actions.tsx` - Row actions
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/data-table-view-options.tsx` - Column visibility
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/user-primary-actions.tsx` - Page actions
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/components/users-stats.tsx` - Stats cards
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/data/schema.ts` - Data schema
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/users/data/data.ts` - Data helpers

### Forms

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/settings/page.tsx` - Settings page
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/settings/components/general-form.tsx` - Form example

### Common Components

- `docs/dev/code-examples/dashboard/src/components/search.tsx` - Search component
- `docs/dev/code-examples/dashboard/src/components/command-menu.tsx` - Command palette
- `docs/dev/code-examples/dashboard/src/components/date-picker.tsx` - Date picker
- `docs/dev/code-examples/dashboard/src/components/errors/` - Error page components
- `docs/dev/code-examples/dashboard/src/hooks/use-dialog-state.tsx` - Dialog state hook

### Charts

- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/revenue-chart.tsx` - Bar chart
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-2/components/visitors.tsx` - Pie chart
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/budget.tsx` - Budget chart
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/radar-card.tsx` - Radar chart
- `docs/dev/code-examples/dashboard/src/app/(dashboard)/dashboard-3/components/stack-bar.tsx` - Stacked bar chart

## Implementation Notes

### When Building Dashboard Features

**1. Use the Layout System:**

- Import `Header` component for page headers
- Use dashboard layout wrapper for sidebar
- Follow consistent spacing patterns
- Add breadcrumbs for nested pages

**2. For Data Tables:**

- Use TanStack Table with provided patterns
- Create column definitions file
- Implement toolbar with filters
- Add pagination component
- Include row actions dropdown
- Add stats cards above table
- Use Zod for data validation

**3. For Forms:**

- Use React Hook Form + Zod
- Follow the field layout pattern
- Include form sections with separators
- Add validation and error messages
- File uploads with preview
- Info banners for context

**4. For Charts:**

- Use Recharts with ChartContainer wrapper
- Define chart config for colors
- Wrap in Card component
- Include chart controls (selects, filters)
- Add tooltips and legends
- Responsive containers

**5. For Navigation:**

- Update sidebar-data.tsx with new routes
- Use NavGroup component structure
- Include icons from Tabler or Lucide
- Support nested navigation items
- Add badges for counts (optional)

**6. For Dialogs:**

- Use useDialogState hook
- Support multiple dialog types
- Conditional rendering
- Proper key props for remounting

**7. For Stats Cards:**

- Icon in colored circle
- Large number display
- Trend indicators
- Description text
- Card wrapper
- Tooltip for additional info

**8. For Error Handling:**

- Use error page components
- Consistent error UI
- Action buttons (retry, go home)
- Appropriate error codes

### Component Reusability

**When to Create New Components:**

- Component used in 2+ places
- Complex logic that benefits from isolation
- Consistent UI pattern
- Reusable across different contexts

**When to Keep Inline:**

- Single-use component
- Simple presentation
- Tightly coupled to parent
- Page-specific logic

### Performance Considerations

**Optimization Strategies:**

- Use React.memo for expensive components
- Lazy load heavy components
- Virtualize long lists
- Debounce search inputs
- Memoize computed values
- Code splitting for routes

**Data Fetching:**

- Server components for initial data
- Client components for interactivity
- TanStack Query for client-side data
- Optimistic updates where appropriate

This reference guide should be consulted when building dashboard features to maintain consistency with proven patterns and best practices from the shadcn-admin template.
