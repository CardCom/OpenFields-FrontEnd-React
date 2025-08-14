# CardCom Open Fields React Example

A modern React + TypeScript implementation of CardCom's Open Fields feature, providing a PCI-compliant payment gateway that integrates seamlessly into existing forms with customizable styling.

### Table of Contents

- [Intro](#intro)
- [Basic Workflow](#basic-workflow)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Configuration](#environment-configuration)
- [List of Actions](#list-of-actions)
- [Backend Requirements](#backend-requirements)
- [Security Features](#security-features)
- [Additional Features](#additional-features)
- [Customization](#customization)
- [Development](#development)


## Intro

This feature allows developers to integrate secure payment fields into existing forms while maintaining complete control over styling and user experience. By utilizing iframes and the [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), you get a PCI-approved payment method that looks and feels exactly how you want.

**Key Benefits:**

- 🔒 **PCI Compliance** - Secure iframe-based payment processing
- 🎨 **Full Customization** - Style payment fields to match your brand
- ⚡ **Modern React/TypeScript** - Built with latest React 19 and TypeScript
- 🌐 **3DS Support** - Built-in 3D Secure authentication
- 💳 **Google Pay Integration** - Alternative payment method included
- 📱 **Responsive Design** - Mobile-friendly implementation



## Basic Workflow

### Required Components

You are required to add a postMessage event listener and 4 specific iframes to your form:

1. **Master Iframe** (`CardComMasterFrame`) - Manages all operations
2. **Credit Card Input** (`CardComCardNumber`) - Secure card number input
3. **CVV Input** (`CardComCvv`) - Secure CVV input  
4. **Google Pay** (`CardComGooglePay`) - Alternative payment method
5. **Credits Footer** (`CardcomCredits`) - CardCom branding

### Implementation Steps

1. **Create LowProfile Deal**: Use [CardCom's LowProfile API](https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json#tag/LowProfile/operation/LowProfile_Create) to create a payment session (handled by backend to protect API credentials)

2. **Initialize Iframes**: Send configuration message to master iframe with styling and LowProfile code using the `init` message

3. **Handle User Input**: Collect additional form data (expiration dates, customer info)

4. **Submit Transaction**: Send `doTransaction` message with all payment data

5. **Handle Response**: Process success/error responses from CardCom


## Project Structure

```
src/
├── components/
│   ├── CheckoutForm.tsx    # Main payment form with iframes
│   └── Summary.tsx         # Order summary component
├── css/
│   └── cardNumber.css      # Styling for card number field
├── types.ts                # TypeScript type definitions
├── App.tsx                 # Main application component
├── index.css               # Global styles
└── main.tsx               # Application entry point
```



## Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend server for LowProfile deal creation

### Installation Steps

1. **Clone and Install Dependencies**

```bash
npm install
```

2. **Configure Environment Variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Development Server**

```bash
npm run dev
```

4. **Start Backend Server** (separate repository/implementation required)

```bash
# Your backend should handle /init endpoint
# Example: http://127.0.0.1:8000/init
```



## Environment Configuration

Create a `.env` file with the following variables:

```properties
# Backend Configuration - Your server handling LowProfile creation
VITE_BACKEND_URL=http://127.0.0.1:8000

# CardCom Configuration
VITE_CARDCOM_URL=https://secure.cardcom.solutions
VITE_CARDCOM_TERMINAL_NUMBER=1000

# Development Settings
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG=true

# Test Configuration
VITE_TEST_CARD_NUMBER=4580000000000000

# Application Info
VITE_APP_NAME=Cardcom Open Fields
VITE_APP_VERSION=1.0.0
```



## List of Actions

### User Actions (Frontend → CardCom)

#### `init`

Initializes the iframes with styling and configuration:

```typescript
{
    action: 'init',
    cardFieldCSS: string,        // CSS for card number field
    cvvFieldCSS: string,         // CSS for CVV field  
    reCaptchaFieldCSS: string,   // CSS for reCaptcha
    placeholder: '1111-2222-3333-4444',
    cvvPlaceholder: '123',
    lowProfileCode: string       // From backend LowProfile creation
}
```

#### `doTransaction`

Submits the payment with all required data:

```typescript
{
    action: 'doTransaction',
    cardOwnerId: string,
    cardOwnerName: string,
    cardOwnerEmail: string,
    expirationMonth: string,     // MM format
    expirationYear: string,      // YY format
    cardOwnerPhone: string,
    numberOfPayments: string,
    document?: DocumentData      // Optional invoice/receipt data
}
```

#### Field Validation Actions

- `addCvvFieldClass` / `removeCvvFieldClass`
- `addCardNumberFieldClass` / `removeCardNumberFieldClass`

#### `setCardOwnerDetails`

Updates card owner information for prefill and validation. This step is required for Google Pay payments:

```typescript
{
    action: 'setCardOwnerDetails',
    data: {
        cardOwnerName: string,
        cardOwnerEmail: string,
        cardOwnerPhone: string
    }
}
```

### CardCom Actions (CardCom → Frontend)

#### `HandleSubmit`

Contains payment processing results:

```typescript
{
    action: 'HandleSubmit',
    data: {
        IsSuccess: boolean,
        Description: string,
        ResponseCode: number,
        InternalDealNumber: number,
        // ... additional response fields
    }
}
```

#### `HandleEror`

Reports payment processing errors:

```typescript
{
    action: 'HandleEror',
    message: string,
    isError: boolean,
    IsDeveloperError?: boolean,
    IsInputError?: boolean
}
```

#### `handleValidations`

Real-time field validation feedback:

```typescript
{
    action: 'handleValidations',
    field: 'cardNumber' | 'cvv' | 'reCaptcha',
    isValid: boolean
}
```

#### `StartedGooglePaySubmit`

Triggered when Google Pay payment begins processing.
Used for triggering loading gifs

#### `validateCvv` | `validateCardNumber`

Those methods allow to validate the fields in the iframes, you can invoke them from your form validation logic.
Meant to allow you to enable / disable the "pay" button in your form according to the fields validations.
The result will return under "handleValidations" message with the field name and the result.
Same behavior occurs on focus out event of those the fields.

```typescript
{
  masterRef.current?.contentWindow?.postMessage({ action: "validateCvv" }, '*');
  masterRef.current?.contentWindow?.postMessage({ action: "validateCardNumber" }, '*');
}
```



## Backend Requirements

Your backend must implement an `/init` endpoint that:

1. **Creates LowProfile Deal** using CardCom API
2. **Returns LowProfile Code** to frontend
3. **Handles API Credentials** securely

Example backend response:

```json
{
    "LowProfileId": "63fca7b4-85a8-4698-9f17-a1739920d958"
}
```

**Security Note**: Never expose CardCom API credentials in frontend code.



## Security Features

### PCI Compliance

- Payment data never touches your servers
- Secure iframe isolation prevents data access
- Industry-standard encryption

### 3D Secure (3DS)

- Automatic 3DS challenge handling
- Seamless authentication flow
- Enhanced fraud protection

### Data Protection

- postMessage API for secure communication
- No payment data stored locally
- Tokenization support



## Additional Features

### Google Pay Integration

- One-click payment option
- Automatic customer data prefill
- Mobile-optimized experience

### Document Generation

Create invoices or receipts automatically:

```typescript
document: {
    DocumentTypeToCreate: "Receipt" | "Invoice" | "Other",
    Products: [{
        ProductID: "ui-321",
        Description: "Product Description", 
        Quantity: 1,
        UnitCost: 9.99,
        TotalLineCost: 9.99
    }]
}
```

### Responsive Design

- Mobile-first approach
- Flexible layout system
- Cross-browser compatibility

### Real-time Validation

- Instant field validation feedback
- Custom error styling
- Accessibility support



## Customization

### Styling Payment Fields

Modify CSS in iframe initialization:

```typescript
const cardFieldCSS = `
    .cardNumber {
        border: 2px solid #your-color;
        border-radius: 8px;
        padding: 12px;
        font-size: 16px;
        background: #your-background;
    }
    .cardNumber.invalid {
        border-color: #error-color;
    }
`;
```

### Custom Validation

Extend the `onValidation` function:

```typescript
const onValidation = (field: string, isValid: boolean) => {
    // Custom validation logic
    if (!isValid) {
        showCustomErrorMessage(field);
    }
};
```

### Theming

Update global CSS variables in `src/index.css`:

```css
:root {
    --primary-color: #your-brand-color;
    --error-color: #your-error-color;
    --border-radius: 8px;
}
```



## Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production  
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### VS Code Tasks

- **Start Server** - Launch PHP development server
- **Run In Browser** - Open application in browser
- **Run In Terminal** - Execute PHP scripts

### Technology Stack

- **React 19** - Latest React with concurrent features
- **TypeScript 5.8** - Type safety and developer experience
- **Vite 7** - Fast build tool and dev server
- **ESLint** - Code quality and consistency

### Testing

Test with CardCom's sandbox environment:

- Test terminal number: `1000` (No deposits, you can't be charged)
- Test terminal username: `test2025` (this is frequentrly changed so contact support to get the latest)
- Test Card: `4580000000000000`
- Any future expiration date
- Any 3-digit CVV



## Support & Documentation

- [CardCom API Documentation](https://secure.cardcom.solutions/swagger)

---

**Need Help?** Contact CardCom support at <support@cardcom.solutions.co.il> or +972-03-

