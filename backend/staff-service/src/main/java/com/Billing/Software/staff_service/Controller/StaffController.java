package com.Billing.Software.staff_service.Controller;

import com.Billing.Software.staff_service.Dtos.AttendanceRequest;
import com.Billing.Software.staff_service.Dtos.SalarySlip;
import com.Billing.Software.staff_service.Dtos.SelfMarkRequest;
import com.Billing.Software.staff_service.Dtos.StaffLoginRequest;
import com.Billing.Software.staff_service.Entity.AppSettings;
import com.Billing.Software.staff_service.Entity.Role;
import com.Billing.Software.staff_service.Entity.Staff;
import com.Billing.Software.staff_service.Service.StaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StaffController {

    private final StaffService service;

    // --- ROLES ---
    @PostMapping("/roles")
    public String addRole(@RequestBody Role role) throws Exception { return service.addRole(role); }

    @GetMapping("/roles")
    public List<Role> getRoles() throws Exception { return service.getAllRoles(); }

    @PutMapping("/roles/{id}")
    public void updateRole(@PathVariable String id, @RequestBody Role role) throws Exception { service.updateRole(id, role); }

    @DeleteMapping("/roles/{id}")
    public void deleteRole(@PathVariable String id) throws Exception { service.deleteRole(id); }

    // --- STAFF ---
    @PostMapping("/add")
    public String addStaff(@RequestBody Staff staff) throws Exception { return service.addStaff(staff); }

    @GetMapping("/all")
    public List<Staff> getAll() throws Exception { return service.getAllStaff(); }

    @GetMapping("/{id}")
    public Staff getById(@PathVariable String id) throws Exception { return service.getStaffById(id); }

    @PatchMapping("/{id}")
    public void update(@PathVariable String id, @RequestBody Map<String, Object> up) throws Exception { service.updateStaff(id, up); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) throws Exception { service.deleteStaff(id); }

    // --- ATTENDANCE ---
    @PostMapping("/attendance/mark-bulk")
    public void markBulk(@RequestBody List<AttendanceRequest> reqs) throws Exception { service.markAttendanceBulk(reqs); }

    @PostMapping("/attendance/mark")
    public void markSingle(@RequestBody AttendanceRequest req) throws Exception { service.markAttendanceSingle(req); }

    @GetMapping("/attendance/day/{date}")
    public Map<String, Object> getDay(@PathVariable String date) throws Exception { return service.getDayAttendance(date); }

    @GetMapping("/attendance/month/{year}/{month}")
    public List<Map<String, Object>> getMonth(@PathVariable String year, @PathVariable String month) throws Exception {
        return service.getMonthAttendance(year, month);
    }

    @GetMapping("/attendance/staff/{staffId}/{yearMonth}")
    public Map<String, Object> getStaffMonth(@PathVariable String staffId, @PathVariable String yearMonth) throws Exception {
        return service.getStaffMonth(staffId, yearMonth);
    }

    // --- COMMISSION ENDPOINTS ---
    @PostMapping("/commissions/add")
    public ResponseEntity<?> addCommission(@RequestBody Map<String, Object> data) throws Exception {
        service.addCommission(data);
        return ResponseEntity.ok(Map.of("message", "Staff commission recorded successfully"));
    }

    @DeleteMapping("/commissions/bill/{billId}")
    public ResponseEntity<?> deleteCommissionsByBillId(@PathVariable String billId) throws Exception {
        service.deleteCommissionsByBillId(billId);
        return ResponseEntity.ok(Map.of("message", "Staff commissions deleted"));
    }

    // --- SALARY ENDPOINT ---
    @GetMapping("/salary/{staffId}/{yearMonth}")
    public SalarySlip getSalarySlip(
            @PathVariable String staffId,
            @PathVariable String yearMonth) throws Exception {
        return service.generateSalarySlip(staffId, yearMonth);
    }

    // --- COMMISSIONS ENDPOINTS ---
    @GetMapping("/commissions/{staffId}")
    public List<Map<String, Object>> getStaffCommissions(
            @PathVariable String staffId,
            @RequestParam String yearMonth) throws Exception {
        return service.getCommissionsForStaff(staffId, yearMonth);
    }

    @GetMapping("/commissions/all")
    public List<Map<String, Object>> getAllCommissions() throws Exception {
        return service.getAllCommissions();
    }

    @PatchMapping("/commissions/{id}/pay")
    public ResponseEntity<?> payCommission(@PathVariable String id) throws Exception {
        service.markCommissionAsPaid(id);
        return ResponseEntity.ok(Map.of("message", "Commission status updated to PAID"));
    }

    // ==================== APP SETTINGS ====================

    @GetMapping("/settings")
    public AppSettings getAppSettings() throws Exception {
        return service.getAppSettings();
    }

    @PostMapping("/settings")
    public ResponseEntity<?> saveAppSettings(@RequestBody AppSettings settings) throws Exception {
        service.saveAppSettings(settings);
        return ResponseEntity.ok(Map.of("message", "App settings saved successfully"));
    }

    // ==================== STAFF AUTH LOGIN (Mobile App) ====================

    @PostMapping("/auth/login")
    public ResponseEntity<?> staffLogin(@RequestBody StaffLoginRequest request) {
        try {
            Map<String, Object> result = service.staffLogin(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", e.getMessage()));
        }
    }

    // ==================== SELF-MARK ATTENDANCE (Mobile App) ====================

    @PostMapping("/attendance/self-mark")
    public ResponseEntity<?> selfMarkAttendance(@RequestBody SelfMarkRequest request) {
        try {
            Map<String, Object> result = service.selfMarkAttendance(request);
            if (Boolean.FALSE.equals(result.get("success"))) {
                return ResponseEntity.status(403).body(result);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ==================== CHECK TODAY ATTENDANCE ====================

    @GetMapping("/attendance/check-today/{staffId}/{date}")
    public Map<String, Object> checkTodayAttendance(
            @PathVariable String staffId,
            @PathVariable String date) throws Exception {
        return service.checkTodayAttendance(staffId, date);
    }

    // ==================== AUTO-ABSENT ====================

    @PostMapping("/attendance/auto-absent/{date}")
    public ResponseEntity<?> autoMarkAbsent(@PathVariable String date) throws Exception {
        service.autoMarkAbsent(date);
        return ResponseEntity.ok(Map.of("message", "Auto-absent marking completed for " + date));
    }

    // ==================== STAFF PROFILE & MY DATA ====================

    @GetMapping("/{id}/profile")
    public Map<String, Object> getStaffProfile(@PathVariable String id) throws Exception {
        return service.getStaffProfile(id);
    }

    @GetMapping("/{id}/my-attendance/{yearMonth}")
    public Map<String, Object> getMyAttendance(
            @PathVariable String id,
            @PathVariable String yearMonth) throws Exception {
        return service.getMyAttendance(id, yearMonth);
    }

    @GetMapping("/{id}/my-salary/{yearMonth}")
    public SalarySlip getMySalary(
            @PathVariable String id,
            @PathVariable String yearMonth) throws Exception {
        return service.getMySalary(id, yearMonth);
    }
}
