# Mobile Web Redirect Feature

This feature automatically redirects mobile users accessing VitalSpark through a web browser to a dedicated download page, encouraging them to use the native mobile app.

## Overview

VitalSpark is designed to provide the best experience through native mobile apps. When mobile users try to access the web version, they are automatically redirected to a download page that directs them to the App Store or Google Play Store.

## Components

### 1. Download App Page (`app/download-app.tsx`)

A professionally designed page featuring:
- **VitalSpark branding** with gradient background and logo
- **Store badges** for both App Store and Google Play
- **Feature highlights** explaining benefits of the mobile app:
  - Faster performance
  - Enhanced security
  - Push notifications
  - Optimized experience
- **Responsive design** that looks great on all mobile devices
- **Interactive buttons** that open the respective app stores

### 2. Mobile Web Redirect Hook (`hooks/useMobileWebRedirect.tsx`)

A React hook that provides:
- **Automatic detection** of mobile web browsers
- **Flexible redirect control** (can be enabled/disabled)
- **Utility functions** for checking if device is mobile web

#### Hook Usage

```typescript
import { useMobileWebRedirect } from "../../hooks/useMobileWebRedirect";

export default function MyScreen() {
  // Enable redirect (default)
  useMobileWebRedirect();
  
  // Disable redirect
  // useMobileWebRedirect(false);
  
  // Your component code...
}
```

#### Utility Function

```typescript
import { isMobileWeb } from "../../hooks/useMobileWebRedirect";

if (isMobileWeb()) {
  // User is on mobile web
}
```

## Implementation

The redirect is currently enabled on:
- ✅ Login screen (`app/(auth)/login.tsx`)
- ✅ Signup screen (`app/(auth)/signup.tsx`)

### Adding to More Pages

To add the redirect to additional pages:

```typescript
import { useMobileWebRedirect } from "../hooks/useMobileWebRedirect";

export default function YourScreen() {
  useMobileWebRedirect(); // Add this line
  
  // Rest of your component...
}
```

## Detection Logic

The system detects mobile web users by checking:

1. **User Agent** - Matches against common mobile browsers:
   - Android
   - iOS (iPhone/iPad)
   - Windows Phone
   - BlackBerry
   - Opera Mini

2. **Screen Size** - Devices with width ≤ 768px

## Store Links

Update the store links in `app/download-app.tsx`:

```typescript
const handleGooglePlayPress = () => {
  // Update this URL with your actual Google Play Store link
  const url = "https://play.google.com/store/apps/details?id=com.vitalspark";
  if (Platform.OS === "web") {
    window.open(url, "_blank");
  }
};

const handleAppStorePress = () => {
  // Update this URL with your actual App Store link
  const url = "https://apps.apple.com/app/vitalspark/id123456789";
  if (Platform.OS === "web") {
    window.open(url, "_blank");
  }
};
```

## Design Features

### Visual Elements
- **Gradient Header** - Teal gradient matching VitalSpark branding
- **White Card** - Clean white card containing main content
- **Feature Icons** - Circular teal icons for feature highlights
- **Store Buttons** - Black buttons with store logos and text
- **Smooth Animations** - Press states on interactive elements

### Branding
- Uses official Google Play and App Store logos
- Maintains VitalSpark color scheme (teal/gradient)
- Professional typography and spacing
- Mobile-optimized layout

### Accessibility
- Proper semantic labels
- Touch-friendly button sizes
- High contrast text
- Screen reader compatible

## Testing

To test the redirect:

1. **Desktop Browser**:
   - Open browser DevTools
   - Toggle device toolbar (mobile emulation)
   - Navigate to login/signup pages
   - Should redirect to `/download-app`

2. **Actual Mobile Device**:
   - Access the web app from a mobile browser
   - Should automatically redirect to download page

3. **Disable Redirect for Testing**:
   ```typescript
   useMobileWebRedirect(false); // Temporarily disable
   ```

## Notes

- The download page itself does NOT have the redirect hook (prevents infinite loops)
- Desktop users are unaffected and can use the web app normally
- The redirect only works on web platform (native apps ignore it)
- Store links need to be updated with actual app URLs before production

## Customization

### Change Detection Threshold

Edit `useMobileWebRedirect.tsx`:

```typescript
const isSmallScreen = window.innerWidth <= 768; // Change this value
```

### Modify Page Design

Edit `download-app.tsx` to customize:
- Colors and gradients
- Feature list
- Layout and spacing
- Button styles
- Text content

### Add More Protected Pages

Simply import and call the hook in any page that should redirect mobile users:

```typescript
import { useMobileWebRedirect } from "../../hooks/useMobileWebRedirect";

export default function ProtectedPage() {
  useMobileWebRedirect();
  // Page content...
}
```

## Future Enhancements

Potential improvements:
- QR code for easy download
- App preview screenshots
- User testimonials
- Feature comparison table
- Newsletter signup
- "Continue to web version" option (if needed)

