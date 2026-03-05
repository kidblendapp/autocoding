# Figma AC Matching Examples

## Example 1: Story with Existing ACs

### Input

**Story Title:** User Authentication Flow

**Description:**
```
*Business Context:*
Users need secure authentication to access the application.

*Acceptance Criteria:*

AC 1 - Login Form
- [ ] User can enter email and password
- [ ] Form validates email format
- [ ] Password field is masked

AC 2 - Authentication Error Handling
- [ ] Invalid credentials show error message
- [ ] Account lockout after 5 failed attempts

AC 3 - Password Recovery
- [ ] User can request password reset
- [ ] Reset link sent via email
```

**Figma Screens Found:**
1. Screen "Login" (ID: 100:200) - 375x812px
2. Screen "Login - Error State" (ID: 100:201) - 375x812px
3. Screen "Forgot Password" (ID: 100:202) - 375x812px
4. Screen "Reset Password" (ID: 100:203) - 375x812px

### Output

```json
{
  "matches": [
    {
      "acId": "AC1",
      "acTitle": "Login Form",
      "screenIds": ["100:200"],
      "confidence": "high",
      "rationale": "Login screen shows email and password input fields with masked password"
    },
    {
      "acId": "AC2",
      "acTitle": "Authentication Error Handling",
      "screenIds": ["100:201"],
      "confidence": "high",
      "rationale": "Login Error State screen displays error message for invalid credentials"
    },
    {
      "acId": "AC3",
      "acTitle": "Password Recovery",
      "screenIds": ["100:202", "100:203"],
      "confidence": "high",
      "rationale": "Forgot Password and Reset Password screens cover the password recovery flow"
    }
  ],
  "suggestedAcs": [],
  "unmatchedScreens": []
}
```

---

## Example 2: Story without ACs (Design-First)

### Input

**Story Title:** Mobile Shopping Cart

**Description:**
```
*Business Context:*
Implement the shopping cart functionality for mobile app based on provided Figma designs.

*User Story:*
As a mobile app user, I want to manage my shopping cart so that I can review and modify items before checkout.
```

**Figma Screens Found:**
1. Screen "Cart - Empty" (ID: 200:100) - 375x812px
2. Screen "Cart - With Items" (ID: 200:101) - 375x812px
3. Screen "Cart - Item Details" (ID: 200:102) - 375x812px
4. Screen "Checkout" (ID: 200:103) - 375x812px

### Output

```json
{
  "matches": [],
  "suggestedAcs": [
    {
      "acId": "AC1",
      "title": "Empty Cart State",
      "screenIds": ["200:100"],
      "requirements": [
        "Display empty cart message when no items added",
        "Show 'Continue Shopping' call-to-action button"
      ]
    },
    {
      "acId": "AC2",
      "title": "Cart Item Display",
      "screenIds": ["200:101"],
      "requirements": [
        "Display list of items in cart with images, names, and prices",
        "Show quantity selector for each item",
        "Display cart total at bottom"
      ]
    },
    {
      "acId": "AC3",
      "title": "Item Detail View",
      "screenIds": ["200:102"],
      "requirements": [
        "User can tap item to see full details",
        "Option to remove item from cart",
        "Option to save item for later"
      ]
    },
    {
      "acId": "AC4",
      "title": "Proceed to Checkout",
      "screenIds": ["200:103"],
      "requirements": [
        "Checkout button navigates to payment flow",
        "Display order summary before checkout"
      ]
    }
  ],
  "unmatchedScreens": []
}
```

---

## Example 3: Partial Match with Unmatched Screens

### Input

**Story Title:** User Profile Management

**Description:**
```
*Acceptance Criteria:*

AC 1 - View Profile
- [ ] User can view their profile information
- [ ] Display avatar, name, and email

AC 2 - Edit Profile
- [ ] User can edit profile fields
- [ ] Changes are saved on submit
```

**Figma Screens Found:**
1. Screen "Profile View" (ID: 300:100)
2. Screen "Profile Edit" (ID: 300:101)
3. Screen "Profile Settings" (ID: 300:102)
4. Screen "Notification Preferences" (ID: 300:103)

### Output

```json
{
  "matches": [
    {
      "acId": "AC1",
      "acTitle": "View Profile",
      "screenIds": ["300:100"],
      "confidence": "high",
      "rationale": "Profile View screen shows user avatar, name, and email information"
    },
    {
      "acId": "AC2",
      "acTitle": "Edit Profile",
      "screenIds": ["300:101"],
      "confidence": "high",
      "rationale": "Profile Edit screen contains editable fields with save button"
    }
  ],
  "suggestedAcs": [],
  "unmatchedScreens": [
    {
      "screenId": "300:102",
      "screenName": "Profile Settings",
      "suggestedAcTitle": "Profile Settings Management"
    },
    {
      "screenId": "300:103",
      "screenName": "Notification Preferences",
      "suggestedAcTitle": "Notification Preferences Configuration"
    }
  ]
}
```

---

## Key Points

1. **High Confidence Match**: Screen name or content directly relates to AC
2. **Multiple Screens per AC**: When an AC spans multiple screens (e.g., a flow)
3. **Suggested ACs**: When no ACs exist, derive them from screen analysis
4. **Unmatched Screens**: Flag screens that may indicate missing requirements
5. **Screen ID Format**: Always use colon format (100:200) in JSON output
