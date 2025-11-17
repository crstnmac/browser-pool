# Browser Pool Frontend

A modern React frontend for the Browser Pool Screenshot-as-a-Service platform.

## Tech Stack

- **React 18** with TypeScript
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **TanStack Query (React Query)** - Powerful data synchronization
- **React Router** - Client-side routing
- **Better Auth** - Authentication solution
- **Dodo Payments** - Payment processing integration
- **React Hook Form** - Form validation
- **Zod** - TypeScript-first schema validation
- **Axios** - HTTP client
- **Sonner** - Toast notifications
- **date-fns** - Date formatting
- **Lucide React** - Beautiful icons

## Features

### User Dashboard
- Real-time usage statistics
- Monthly quota tracking
- Recent screenshots gallery
- Plan information display

### Screenshot Management
- Create single screenshots with custom settings
- View screenshot history with pagination
- Download screenshots
- Delete screenshots
- Full-page capture support
- Custom dimensions and formats

### API Keys Management
- Create multiple API keys
- View key usage statistics
- Revoke keys
- Secure key display with copy functionality

### Subscription Management
- View current subscription status
- Compare available plans (Free, Pro, Enterprise)
- Upgrade/downgrade plans via Dodo Payments
- Cancel or reactivate subscriptions
- Payment history with receipts

### Account Settings
- Update profile information
- Change password
- Email verification status

### Admin Dashboard (Enterprise only)
- System-wide analytics
- User management
- Screenshot statistics
- Error rate monitoring
- Users by plan breakdown

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Backend API running (see main README)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
VITE_API_URL=http://localhost:3000
VITE_DODO_PAYMENTS_PUBLIC_KEY=your_public_key_here
```

### Development

Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Layout.tsx      # Main layout with sidebar
│   │   └── ProtectedRoute.tsx
│   ├── pages/              # Route pages
│   │   ├── Landing.tsx     # Public landing page
│   │   ├── Login.tsx       # Authentication
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Screenshots.tsx # Screenshot management
│   │   ├── ApiKeys.tsx     # API key management
│   │   ├── Subscription.tsx # Billing & subscriptions
│   │   ├── Settings.tsx    # Account settings
│   │   ├── Webhooks.tsx    # Webhook configuration
│   │   ├── Scheduled.tsx   # Scheduled screenshots
│   │   └── Admin.tsx       # Admin dashboard
│   ├── services/           # API services
│   │   └── api.ts          # API client & endpoints
│   ├── hooks/              # Custom React hooks
│   │   └── use-api.ts      # React Query hooks
│   ├── lib/                # Utility libraries
│   │   ├── auth.ts         # Better Auth configuration
│   │   ├── query-client.ts # React Query setup
│   │   └── utils.ts        # Helper functions
│   ├── types/              # TypeScript types
│   │   └── api.ts          # API type definitions
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── .env.example            # Environment variables template
├── components.json         # shadcn/ui configuration
├── tailwind.config.js      # Tailwind configuration
└── vite.config.ts          # Vite configuration
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
| `VITE_DODO_PAYMENTS_PUBLIC_KEY` | Dodo Payments public key | - |

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT License - see LICENSE file for details
