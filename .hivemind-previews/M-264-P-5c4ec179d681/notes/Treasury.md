## Treasury Parameters and Operational Controls for Login Page Implementation

### On-Chain Parameter Suggestions
1. **User Authentication Token Expiry**
   - **Parameter:** `tokenExpiry`
   - **Default Value:** `3600` seconds (1 hour)
   - **Description:** Duration for which the JWT token remains valid. After expiry, users must log in again for security purposes.

2. **Password Hashing Algorithm**
   - **Parameter:** `passwordHashAlgorithm`
   - **Default Value:** `bcrypt`
   - **Description:** The hashing algorithm used to securely store user passwords. Bcrypt is recommended due to its adaptive nature and resistance to brute-force attacks.

3. **Session Management**
   - **Parameter:** `sessionTimeout`
   - **Default Value:** `1800` seconds (30 minutes)
   - **Description:** Duration after which an inactive session will be automatically logged out to enhance security.

4. **Two-Factor Authentication (2FA)**
   - **Parameter:** `enable2FA`
   - **Default Value:** `true`
   - **Description:** Indicates whether two-factor authentication is enabled for additional security during the login process.

5. **Password Complexity Requirements**
   - **Parameter:** `passwordComplexity`
   - **Default Value:** `{ minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true }`
   - **Description:** Defines the complexity requirements for user passwords to enhance security.

### Operational Controls
1. **Secure Data Transmission**
   - **Control:** Ensure that all data exchanged between the client and server is transmitted over HTTPS to prevent eavesdropping and man-in-the-middle attacks.

2. **Rate Limiting**
   - **Control:** Implement rate limiting on the login API endpoint (`/api/login`) to prevent brute-force attacks. For example, allow a maximum of 5 login attempts per minute per IP address.

3. **Error Handling**
   - **Control:** Provide generic error messages for failed login attempts (e.g., "Invalid username or password") to prevent information leakage about valid usernames.

4. **Logging and Monitoring**
   - **Control:** Implement logging for all authentication attempts, including successful and failed logins, to monitor for suspicious activity and potential breaches.

5. **Password Recovery Security**
   - **Control:** Ensure that the password recovery process (`/api/recover-password`) includes verification steps (e.g., email confirmation) to prevent unauthorized access to user accounts.

6. **User Education**
   - **Control:** Provide users with information on creating strong passwords and recognizing phishing attempts, enhancing overall security awareness.

### Summary
Implementing these on-chain parameters and operational controls will help ensure that the login page is not only user-friendly but also secure and compliant with best practices in authentication and data protection.