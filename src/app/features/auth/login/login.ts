import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule, NgIf, NgClass } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, NgIf, NgClass, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {

  loading = false;
  error: string | null = null;
  showPassword = false; // Toggle password visibility

  // Strongly typed form controls
  loginForm!: FormGroup<{
    email: FormControl<string>;
    password: FormControl<string>;
  }>;

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize strongly typed, non-nullable form controls
    this.loginForm = this.fb.group({
      email: new FormControl('', { 
        nonNullable: true, 
        validators: [Validators.required, Validators.email] 
      }),
      password: new FormControl('', { 
        nonNullable: true, 
        validators: [Validators.required, Validators.minLength(6)] 
      })
    });
  }

  // Toggle password visibility
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = null;

    // Safe: nonNullable form controls guarantee strings
    const { email, password } = this.loginForm.value;

    try {
      await this.auth.login(email!, password!);
      // Redirect after login
      
      this.router.navigate(['/']);
    } catch (err: any) {
      // Map common auth errors to user-friendly messages
      if (err.code === 'auth/user-not-found') {
        this.error = 'User not found';
      } else if (err.code === 'auth/wrong-password') {
        this.error = 'Incorrect password';
      } else {
        this.error = err?.message || 'Login failed';
      }

      // Reset password field after failed login
      this.loginForm.get('password')?.reset();
    } finally {
      this.loading = false;
    }
  }
  forgotPassword() {
  const email = this.loginForm.get('email')?.value;

  if (!email) {
    this.error = 'Please enter your email to reset your password';
    return;
  }

  this.auth.sendPasswordResetEmail(email)
    .then(() => {
      this.error = null;
      alert('Password reset email sent! Please check your inbox.');
    })
    .catch(err => {
      if (err.code === 'auth/user-not-found') {
        this.error = 'No account found with this email';
      } else {
        this.error = err.message || 'Failed to send password reset email';
      }
    });
}

}
