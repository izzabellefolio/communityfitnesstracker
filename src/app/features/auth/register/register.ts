import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { ProgressService } from '../../../core/services/progress.service';
import { UserService } from '../../../core/services/user.service';
import { UserMetrics } from '../../../shared/models';
import { Router, RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register {
  loading = false;
  error: string | null = null;

  userBMI: number | null = null;
  showPassword = false;
  showConfirmPassword = false;

  registerForm!: FormGroup<{
    displayName: FormControl<string | null>;
    email: FormControl<string | null>;
    password: FormControl<string | null>;
    confirmPassword: FormControl<string | null>;
    weight: FormControl<number | null>;
    height: FormControl<number | null>;
    metabolism: FormControl<string | null>;
  }>;

  constructor(
    private fb: FormBuilder,
    private auth: Auth,
    private progressService: ProgressService,
    private userService: UserService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        displayName: this.fb.control<string | null>(null, [
          Validators.required,
          Validators.minLength(2)
        ]),
        email: this.fb.control<string | null>(null, [
          Validators.required,
          Validators.email
        ]),
        password: this.fb.control<string | null>(null, [
          Validators.required,
          Validators.minLength(6)
        ]),
        confirmPassword: this.fb.control<string | null>(null, [
          Validators.required
        ]),

        // user metrics
        weight: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(20),
          Validators.max(500)
        ]),
        height: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(100),
          Validators.max(250)
        ]),
        metabolism: this.fb.control<string | null>('medium', [
          Validators.required
        ])
      },
      { validators: this.passwordsMatch }
    );
  }

  // Calculate BMI
  private calculateBMI(weight: number, height: number): number {
    const h = height / 100;
    return Number((weight / (h * h)).toFixed(1));
  }

  // Custom validator
  passwordsMatch(group: FormGroup) {
    const pw = group.get('password')?.value;
    const cpw = group.get('confirmPassword')?.value;
    return pw === cpw ? null : { notMatching: true };
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      if (this.registerForm.hasError('notMatching')) {
        this.error = 'Passwords do not match';
      }
      return;
    }

    this.loading = true;
    this.error = null;

    const { displayName, email, password, weight, height, metabolism } =
      this.registerForm.value;

    try {
      console.log('Starting registration...');
      
      // 1. Create Firebase Auth user
      const user = await this.auth.register(email!, password!, displayName!);
      console.log('User created:', user.uid);

      // 2. Compute BMI locally for UI display
      let bmi = 0;
      if (weight != null && height != null) {
        bmi = this.calculateBMI(weight, height);
        this.userBMI = bmi;
      }

      // 3. Map metabolism value
      const mappedMetabolism: 'slow' | 'medium' | 'fast' =
        metabolism === 'low' ? 'slow' : metabolism === 'high' ? 'fast' : 'medium';

      console.log('Saving user metrics to Firestore...');
      
      // 4. Save metrics into Firestore via ProgressService
      await this.progressService.saveUserMetricsV2(user.uid, {
        weight: weight ?? 0,
        height: height ?? 0,
        metabolism: mappedMetabolism,
        gender: 'other'
      });
      console.log('Metrics saved to Firestore');

      // 5. Update weight in userStats
      try {
        await lastValueFrom(this.progressService.updateWeight(weight ?? 0));
        console.log('Weight updated in userStats');
      } catch (err) {
        console.warn('updateWeight failed (non-critical):', err);
      }

      // 6. Create complete metrics object for UserService
      const metrics: UserMetrics = {
        userId: user.uid,
        weight: weight ?? 0,
        height: height ?? 0,
        metabolism: mappedMetabolism,
        bmi,
        gender: 'other',
        lastUpdated: new Date()
      };

      console.log('Setting metrics in UserService:', metrics);
      
      // 7. Update UserService immediately for instant UI update
      this.userService.setMetrics(metrics);
      
      // 8. Force a refresh of stats
      try {
        await lastValueFrom(this.progressService.getUserStats().pipe(take(1)));
      } catch (err) {
        console.warn('getUserStats failed (non-critical):', err);
      }

      // 9. Brief delay to ensure Firestore writes complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Registration complete, navigating to home...');
      
      // 10. Navigate after successful registration
      await this.router.navigate(['/']);
    } catch (err: any) {
      console.error('Registration error:', err);
      this.error = err?.message || 'Registration failed';
      this.loading = false;
    }
  }
}