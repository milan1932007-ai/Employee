import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ==========================================================
  // API ROUTES (Always mount before Vite middleware)
  // ==========================================================

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // DB Configuration & Status
  app.get('/api/config/status', async (req: Request, res: Response) => {
    try {
      const status = await db.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to check database status' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const user = await db.login(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials. Check email and password.' });
      }
      res.json({ success: true, user, token: 'mock-jwt-' + Buffer.from(user.email).toString('base64') });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Forgot Password
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }
      const result = await db.forgotPassword(email);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Stats
  app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
      const stats = await db.getDashboardStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Employees
  app.get('/api/employees', async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const departmentId = req.query.department_id as string;
      const employees = await db.getEmployees({ search, departmentId });
      res.json(employees);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const employee = await db.getEmployeeById(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(employee);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/employees', async (req: Request, res: Response) => {
    try {
      const required = ['employee_id', 'full_name', 'gender', 'dob', 'email', 'phone', 'designation', 'salary'];
      for (const field of required) {
        if (!req.body[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }
      const created = await db.createEmployee(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.updateEmployee(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const success = await db.deleteEmployee(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Departments
  app.get('/api/departments', async (req: Request, res: Response) => {
    try {
      const depts = await db.getDepartments();
      res.json(depts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/departments', async (req: Request, res: Response) => {
    try {
      const { department_name, department_head, description } = req.body;
      if (!department_name || !department_head) {
        return res.status(400).json({ error: 'Department name and head are required' });
      }
      const created = await db.createDepartment({ department_name, department_head, description: description || '' });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/departments/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.updateDepartment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/departments/:id', async (req: Request, res: Response) => {
    try {
      const success = await db.deleteDepartment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json({ success: true, message: 'Department removed successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Attendance
  app.get('/api/attendance', async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      const employee_id = req.query.employee_id as string;
      const list = await db.getAttendance({ date, employee_id });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/attendance', async (req: Request, res: Response) => {
    try {
      const { employee_id, date, status, check_in, check_out } = req.body;
      if (!employee_id || !date || !status) {
        return res.status(400).json({ error: 'employee_id, date, and status are required' });
      }
      const saved = await db.markAttendance({ employee_id, date, status, check_in, check_out });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Leaves
  app.get('/api/leaves', async (req: Request, res: Response) => {
    try {
      const employee_id = req.query.employee_id as string;
      const status = req.query.status as string;
      const list = await db.getLeaves({ employee_id, status });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leaves', async (req: Request, res: Response) => {
    try {
      const { employee_id, leave_type, start_date, end_date, reason } = req.body;
      if (!employee_id || !leave_type || !start_date || !end_date || !reason) {
        return res.status(400).json({ error: 'All leave fields are required' });
      }
      const start = new Date(start_date).getTime();
      const end = new Date(end_date).getTime();
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

      const created = await db.applyLeave({
        employee_id,
        leave_type,
        start_date,
        end_date,
        days_count: days,
        reason,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/leaves/:id/status', async (req: Request, res: Response) => {
    try {
      const { status, approved_by } = req.body;
      if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be Approved or Rejected' });
      }
      const updated = await db.updateLeaveStatus(req.params.id, status, approved_by || 'Admin');
      if (!updated) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Salaries
  app.get('/api/salaries', async (req: Request, res: Response) => {
    try {
      const employee_id = req.query.employee_id as string;
      const month_year = req.query.month_year as string;
      const list = await db.getSalaries({ employee_id, month_year });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/salaries', async (req: Request, res: Response) => {
    try {
      const { employee_id, basic_salary, allowances, deductions, payment_date, month_year, payment_status } = req.body;
      if (!employee_id || basic_salary === undefined) {
        return res.status(400).json({ error: 'Employee and basic salary are required' });
      }
      const created = await db.createSalary({
        employee_id,
        basic_salary: Number(basic_salary),
        allowances: Number(allowances || 0),
        deductions: Number(deductions || 0),
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        month_year: month_year || new Date().toLocaleString('default', { month: 'short', year: 'numeric' }),
        payment_status: payment_status || 'Paid',
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Performance
  app.get('/api/performance', async (req: Request, res: Response) => {
    try {
      const employee_id = req.query.employee_id as string;
      const list = await db.getPerformance({ employee_id });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/performance', async (req: Request, res: Response) => {
    try {
      const { employee_id, rating, achievements, feedback, reviewer_name } = req.body;
      if (!employee_id || !rating || !feedback) {
        return res.status(400).json({ error: 'Employee ID, rating (1-5), and feedback are required' });
      }
      const created = await db.createPerformance({
        employee_id,
        rating: Math.min(5, Math.max(1, Number(rating))),
        achievements: achievements || '',
        feedback,
        reviewer_name: reviewer_name || 'Admin',
        review_date: new Date().toISOString().split('T')[0],
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/performance/:id', async (req: Request, res: Response) => {
    try {
      const success = await db.deletePerformance(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Performance record not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reports Summary
  app.get('/api/reports/summary', async (req: Request, res: Response) => {
    try {
      const [employees, departments, attendance, leaves, salaries, performance] = await Promise.all([
        db.getEmployees(),
        db.getDepartments(),
        db.getAttendance(),
        db.getLeaves(),
        db.getSalaries(),
        db.getPerformance(),
      ]);

      res.json({
        employees,
        departments,
        attendance,
        leaves,
        salaries,
        performance,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================================
  // VITE MIDDLEWARE / STATIC ASSETS (Express v4 format)
  // ==========================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EMS Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[EMS Server] Startup error:', err);
});
