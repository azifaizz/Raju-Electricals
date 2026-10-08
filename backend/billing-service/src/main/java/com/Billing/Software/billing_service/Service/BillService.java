package com.Billing.Software.billing_service.Service;

import com.Billing.Software.billing_service.Entity.Bill;
import com.Billing.Software.billing_service.Entity.BillDetails;
import com.Billing.Software.billing_service.Entity.Notification;
import com.Billing.Software.billing_service.dto.BillRequest;
import com.Billing.Software.billing_service.dto.BillTransactionDTO;
import com.Billing.Software.billing_service.dto.CommissionDTO;
import com.Billing.Software.billing_service.dto.CustomerDTO;
import com.Billing.Software.billing_service.feign.ProductClient;
import com.Billing.Software.billing_service.feign.VendorClient;
import com.Billing.Software.billing_service.feign.StaffClient;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillService {

    private final ProductClient productClient;
    private final VendorClient vendorClient;
    private final StaffClient staffClient;
    private final NotificationService notificationService; // Added
    private final Firestore firestore;
    private static final String COL = "bills";

    // 0. Mapping Wrapper for BillRequest
    
    public Bill processBillRequest(String auth, BillRequest request, String cashierId, String status) throws Exception {
        Bill bill = new Bill();
        bill.setId(request.getId());
        bill.setCreatedAt(request.getCreatedAt());
        bill.setStatus(request.getStatus());
        bill.setBillType(request.getBillType());
        bill.setCustomerName(request.getCustomerName());
        bill.setCustomerPhone(request.getCustomerPhone());
        bill.setCustomerEmail(request.getCustomerEmail());
        bill.setCustomerGst(request.getCustomerGst());
        bill.setCustomerAddress(request.getCustomerAddress());
        bill.setPaymentMethod(request.getPaymentMethod());
        bill.setAmountPaid(request.getAmountPaid());
        bill.setCashAmount(request.getCashAmount());
        bill.setOnlineAmount(request.getOnlineAmount());
        bill.setPaymentHistory(request.getPaymentHistory());
        bill.setItems(request.getItems());
        bill.setTotalDiscountAmount(request.getTotalDiscountAmount());
        bill.setTotalGstAmount(request.getTotalGstAmount());
        bill.setFinalAmount(request.getFinalAmount());
        bill.setBrokerId(request.getBrokerId());
        bill.setCommissionAmount(request.getCommissionAmount());
        bill.setStaffId(request.getStaffId());
        bill.setStaffCommissionPercentage(request.getStaffCommissionPercentage());

        // Reminder Fields (Explictly handled)
        bill.setPaymentReminderEnabled(request.getPaymentReminderEnabled());
        bill.setPaymentReminderDays(request.getPaymentReminderDays());
        bill.setPaymentReminderDate(request.getPaymentReminderDate());

        // TRANSPORT & SHIP TO FIELDS
        bill.setVehicleNo(request.getVehicleNo());
        bill.setDispatchThrough(request.getDispatchThrough());
        bill.setDestination(request.getDestination());
        bill.setTermsOfDelivery(request.getTermsOfDelivery());
        bill.setTransportAmount(request.getTransportAmount());
        bill.setTransportGstRate(request.getTransportGstRate());
        bill.setIsShipToDifferent(request.getIsShipToDifferent());
        bill.setShipToName(request.getShipToName());
        bill.setShipToPhone(request.getShipToPhone());
        bill.setShipToEmail(request.getShipToEmail());
        bill.setShipToAddress(request.getShipToAddress());
        bill.setShipToGst(request.getShipToGst());

        calculateAndSetTaxDetails(bill);

        return processBill(auth, bill, cashierId, status);
    }

    private void calculateAndSetTaxDetails(Bill bill) {
        if (bill.getItems() == null || bill.getItems().isEmpty())
            return;

        // Add transport as a product item at the end if transport amount is provided
        if (bill.getTransportAmount() != null && bill.getTransportAmount().compareTo(BigDecimal.ZERO) > 0) {
            boolean transportAlreadyAdded = bill.getItems().stream()
                    .anyMatch(item -> "TRANSPORT_CHARGE".equals(item.getProductId()));
            if (!transportAlreadyAdded) {
                BillDetails transportItem = new BillDetails();
                transportItem.setProductId("TRANSPORT_CHARGE");
                transportItem.setProductName("Transport Charge");
                transportItem.setQuantity(1);
                transportItem.setUnit("");
                BigDecimal tGstRate = bill.getTransportGstRate() != null ? bill.getTransportGstRate() : new BigDecimal(18);
                BigDecimal inclusivePrice = bill.getTransportAmount()
                        .multiply(BigDecimal.ONE.add(tGstRate.divide(new BigDecimal(100), 4, RoundingMode.HALF_UP)))
                        .setScale(2, RoundingMode.HALF_UP);
                transportItem.setUnitPrice(inclusivePrice);
                transportItem.setGstRate(tGstRate);
                transportItem.setDiscountRate(BigDecimal.ZERO);
                transportItem.setHsnsac("");
                transportItem.setPurchaseRate(BigDecimal.ZERO);
                transportItem.setPurchaseGstRate(BigDecimal.ZERO);
                bill.getItems().add(transportItem);
            }
        }

        // Determine if it's Intra-state or Inter-state
        String sellerState = "33"; // Default Tamil Nadu
        String buyerState = bill.getCustomerGst() != null && bill.getCustomerGst().length() >= 2
                ? bill.getCustomerGst().substring(0, 2)
                : (bill.getBuyerStateCode() != null ? bill.getBuyerStateCode() : "33");

        boolean isIntraState = sellerState.equals(buyerState);

        BigDecimal accumulatedTaxable = BigDecimal.ZERO;
        BigDecimal accumulatedCGST = BigDecimal.ZERO;
        BigDecimal accumulatedSGST = BigDecimal.ZERO;
        BigDecimal accumulatedIGST = BigDecimal.ZERO;

        for (BillDetails item : bill.getItems()) {
            BigDecimal qty = new BigDecimal(item.getQuantity());
            BigDecimal unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
            BigDecimal gstRate = item.getGstRate() != null ? item.getGstRate() : BigDecimal.ZERO;

            // lineTotal = unitPrice * quantity
            BigDecimal lineTotal = unitPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);
            item.setNetAmount(lineTotal);

            // taxableValue = lineTotal / (1 + gstPercent / 100)
            BigDecimal gstFactor = BigDecimal.ONE.add(gstRate.divide(new BigDecimal(100), 4, RoundingMode.HALF_UP));
            BigDecimal taxableValue = lineTotal.divide(gstFactor, 2, RoundingMode.HALF_UP);
            item.setTaxableValue(taxableValue);

            accumulatedTaxable = accumulatedTaxable.add(taxableValue);

            // gstAmount = lineTotal - taxableValue
            BigDecimal gstAmount = lineTotal.subtract(taxableValue);
            item.setGstAmount(gstAmount);

            if (isIntraState) {
                // cgstAmount = sgstAmount = gstAmount / 2
                BigDecimal cgstAmount = gstAmount.divide(new BigDecimal(2), 2, RoundingMode.HALF_UP);
                BigDecimal sgstAmount = gstAmount.subtract(cgstAmount);

                item.setCgstAmount(cgstAmount);
                item.setSgstAmount(sgstAmount);
                item.setIgstAmount(BigDecimal.ZERO);

                BigDecimal halfRate = gstRate.divide(new BigDecimal(2), 2, RoundingMode.HALF_UP);
                item.setCgstPercent(halfRate);
                item.setSgstPercent(halfRate);
                item.setIgstPercent(BigDecimal.ZERO);

                accumulatedCGST = accumulatedCGST.add(cgstAmount);
                accumulatedSGST = accumulatedSGST.add(sgstAmount);
            } else {
                item.setCgstAmount(BigDecimal.ZERO);
                item.setSgstAmount(BigDecimal.ZERO);
                item.setIgstAmount(gstAmount);

                item.setCgstPercent(BigDecimal.ZERO);
                item.setSgstPercent(BigDecimal.ZERO);
                item.setIgstPercent(gstRate);

                accumulatedIGST = accumulatedIGST.add(gstAmount);
            }
        }

        // Set Bill Totals
        bill.setTotalTaxable(accumulatedTaxable.setScale(2, RoundingMode.HALF_UP));
        bill.setTotalCGST(accumulatedCGST.setScale(2, RoundingMode.HALF_UP));
        bill.setTotalSGST(accumulatedSGST.setScale(2, RoundingMode.HALF_UP));
        bill.setTotalIGST(accumulatedIGST.setScale(2, RoundingMode.HALF_UP));
        bill.setTotalGstAmount(
                accumulatedCGST.add(accumulatedSGST).add(accumulatedIGST).setScale(2, RoundingMode.HALF_UP));

        // grandTotal = totalTaxable + totalGstAmount
        BigDecimal grandTotalRaw = accumulatedTaxable.add(bill.getTotalGstAmount());
        BigDecimal grandTotalRounded = grandTotalRaw.setScale(0, RoundingMode.HALF_UP).setScale(2);

        bill.setFinalAmount(grandTotalRounded);
        bill.setRoundOffAmount(grandTotalRounded.subtract(grandTotalRaw).setScale(2, RoundingMode.HALF_UP));

        bill.setSellerStateCode(sellerState);
        bill.setBuyerStateCode(buyerState);
    }

    // 1. CREATE / HOLD Logic
    public Bill processBill(String auth, Bill bill, String cashierId, String status) throws Exception {
        log.info("Processing Bill: Status={}, CashierId={}, Bill={}", status, cashierId, bill);
        // --- NEW VALIDATION: Partial/Pending bills MUST have a customer phone ---
        if (("PARTIAL".equals(status) || "PENDING".equals(status)) && bill.getCustomerPhone() == 0) {
            throw new IllegalArgumentException("Customer selection is required for Partial or Credit bills.");
        }

        if (bill.getId() == null || bill.getId().trim().isEmpty()) {
            bill.setId(generateSequentialId());
        }

        BigDecimal amountPaid = bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO;
        if (amountPaid.compareTo(bill.getFinalAmount()) >= 0) {
            bill.setStatus("PAID");
        } else if (amountPaid.compareTo(BigDecimal.ZERO) > 0) {
            bill.setStatus("PARTIAL");
        } else {
            bill.setStatus("PENDING");
        }

        bill.setCashierId(cashierId);
        if (bill.getCreatedAt() == null) {
            bill.setCreatedAt(new Date());
        }

        if (bill.getBillType() == null || bill.getBillType().isEmpty()) {
            bill.setBillType("GST_INVOICE");
        }

        // --- MODIFIED: Sync even for PARTIAL/PENDING statuses (Exclude HOLD) ---
        if (!"HOLD".equals(status)) {
            adjustStockBulkParallel(auth, bill.getItems(), true);

            CompletableFuture.supplyAsync(() -> syncCustomerAndGetId(auth, bill))
                    .thenAccept(customerId -> {
                        if (customerId != null) {
                            bill.setCustomerId(customerId);
                            // Persist customerId to Firestore after async resolution
                            firestore.collection(COL).document(bill.getId()).update("customerId", customerId);
                            recordCustomerTransaction(auth, bill, customerId);
                        }
                    });

            // Set reminder logic for PARTIAL/PENDING bills
            if ("PARTIAL".equals(status) || "PENDING".equals(status)) {
                if (bill.getPaymentReminderEnabled() != null && bill.getPaymentReminderEnabled()) {
                    int days = bill.getPaymentReminderDays() != null ? bill.getPaymentReminderDays() : 7;
                    Calendar cal = Calendar.getInstance();
                    cal.setTime(new Date());
                    cal.add(Calendar.DAY_OF_YEAR, days);
                    bill.setPaymentReminderDate(cal.getTime());
                    bill.setReminderTriggered(false);
                }
            }

            recordCommission(auth, bill);
            recordStaffCommission(auth, bill); // NEW Staff logic
        }

        try {
            firestore.collection(COL).document(bill.getId()).set(bill).get();
            return bill;
        } catch (Exception e) {
            log.error("Failed to save bill to Firestore: {}", e.getMessage(), e);
            throw e;
        }
    }



    // 2. HOLD -> PAID Logic
    
    public Bill finalizeHeldBill(String auth, String id, Bill updateRequest, String cashierId) throws Exception {
        DocumentReference docRef = firestore.collection(COL).document(id);
        DocumentSnapshot existingSnap = docRef.get().get();

        if (!existingSnap.exists())
            throw new NoSuchElementException("Bill not found");
        Bill existingBill = existingSnap.toObject(Bill.class);

        if (updateRequest.getCustomerName() != null)
            existingBill.setCustomerName(updateRequest.getCustomerName());
        if (updateRequest.getCustomerPhone() != 0)
            existingBill.setCustomerPhone(updateRequest.getCustomerPhone());
        if (updateRequest.getCustomerEmail() != null)
            existingBill.setCustomerEmail(updateRequest.getCustomerEmail());
        if (updateRequest.getCustomerAddress() != null)
            existingBill.setCustomerAddress(updateRequest.getCustomerAddress());
        if (updateRequest.getPaymentMethod() != null)
            existingBill.setPaymentMethod(updateRequest.getPaymentMethod());
        if (updateRequest.getAmountPaid() != null)
            existingBill.setAmountPaid(updateRequest.getAmountPaid());
        if (updateRequest.getBillType() != null)
            existingBill.setBillType(updateRequest.getBillType());

        if (updateRequest.getBrokerId() != null)
            existingBill.setBrokerId(updateRequest.getBrokerId());
        if (updateRequest.getCommissionAmount() != null)
            existingBill.setCommissionAmount(updateRequest.getCommissionAmount());

        // NEW Staff Fields Mapping
        if (updateRequest.getStaffId() != null)
            existingBill.setStaffId(updateRequest.getStaffId());
        if (updateRequest.getStaffCommissionPercentage() != null)
            existingBill.setStaffCommissionPercentage(updateRequest.getStaffCommissionPercentage());

        // TRANSPORT & SHIP TO FIELDS
        if (updateRequest.getVehicleNo() != null) existingBill.setVehicleNo(updateRequest.getVehicleNo());
        if (updateRequest.getDispatchThrough() != null) existingBill.setDispatchThrough(updateRequest.getDispatchThrough());
        if (updateRequest.getDestination() != null) existingBill.setDestination(updateRequest.getDestination());
        if (updateRequest.getTermsOfDelivery() != null) existingBill.setTermsOfDelivery(updateRequest.getTermsOfDelivery());
        if (updateRequest.getTransportAmount() != null) existingBill.setTransportAmount(updateRequest.getTransportAmount());
        if (updateRequest.getTransportGstRate() != null) existingBill.setTransportGstRate(updateRequest.getTransportGstRate());
        if (updateRequest.getIsShipToDifferent() != null) existingBill.setIsShipToDifferent(updateRequest.getIsShipToDifferent());
        if (updateRequest.getShipToName() != null) existingBill.setShipToName(updateRequest.getShipToName());
        if (updateRequest.getShipToPhone() != null) existingBill.setShipToPhone(updateRequest.getShipToPhone());
        if (updateRequest.getShipToEmail() != null) existingBill.setShipToEmail(updateRequest.getShipToEmail());
        if (updateRequest.getShipToAddress() != null) existingBill.setShipToAddress(updateRequest.getShipToAddress());
        if (updateRequest.getShipToGst() != null) existingBill.setShipToGst(updateRequest.getShipToGst());

        if (updateRequest.getItems() != null && !updateRequest.getItems().isEmpty()) {
            existingBill.setItems(updateRequest.getItems());
            existingBill.setTotalDiscountAmount(updateRequest.getTotalDiscountAmount());
            existingBill.setTotalGstAmount(updateRequest.getTotalGstAmount());
            existingBill.setFinalAmount(updateRequest.getFinalAmount());
            calculateAndSetTaxDetails(existingBill);
            adjustStockBulkParallel(auth, existingBill.getItems(), true);
        }

        BigDecimal finalAmountPaid = existingBill.getAmountPaid() != null ? existingBill.getAmountPaid()
                : BigDecimal.ZERO;
        if (finalAmountPaid.compareTo(existingBill.getFinalAmount()) >= 0) {
            existingBill.setStatus("PAID");
        } else if (finalAmountPaid.compareTo(BigDecimal.ZERO) > 0) {
            existingBill.setStatus("PARTIAL");
        } else {
            existingBill.setStatus("PENDING");
        }

        existingBill.setCashierId(cashierId);
        existingBill.setUpdatedAt(new Date());

        if (!"HOLD".equals(existingBill.getStatus())) {
            CompletableFuture.supplyAsync(() -> syncCustomerAndGetId(auth, existingBill))
                    .thenAccept(customerId -> {
                        if (customerId != null) {
                            recordCustomerTransaction(auth, existingBill, customerId);
                        }
                    });

            // Set reminder logic for PARTIAL/PENDING bills if status updated
            if ("PARTIAL".equals(existingBill.getStatus()) || "PENDING".equals(existingBill.getStatus())) {
                if (existingBill.getPaymentReminderEnabled() != null && existingBill.getPaymentReminderEnabled()) {
                    int days = existingBill.getPaymentReminderDays() != null ? existingBill.getPaymentReminderDays()
                            : 7;
                    Calendar cal = Calendar.getInstance();
                    cal.setTime(new Date());
                    cal.add(Calendar.DAY_OF_YEAR, days);
                    existingBill.setPaymentReminderDate(cal.getTime());
                    existingBill.setReminderTriggered(false);
                }
            }

            recordCommission(auth, existingBill);
            recordStaffCommission(auth, existingBill); // NEW Staff logic
        }

        docRef.set(existingBill, SetOptions.merge()).get();
        return existingBill;
    }

    // --- NEW HELPER: Staff Commission Calculation ---
    private void recordStaffCommission(String auth, Bill bill) {
        if (bill.getStaffId() != null && !bill.getStaffId().isEmpty() &&
                bill.getStaffCommissionPercentage() != null &&
                bill.getStaffCommissionPercentage().compareTo(BigDecimal.ZERO) > 0) {

            CompletableFuture.runAsync(() -> {
                try {
                    // Calculation: Final Amount * (Percent / 100)
                    BigDecimal amount = bill.getFinalAmount()
                            .multiply(bill.getStaffCommissionPercentage())
                            .divide(new BigDecimal(100), 2, RoundingMode.HALF_UP);

                    bill.setStaffCommissionAmount(amount);

                    Map<String, Object> data = new HashMap<>();
                    data.put("billId", bill.getId());
                    data.put("staffId", bill.getStaffId());
                    data.put("amount", amount.doubleValue());
                    data.put("percentage", bill.getStaffCommissionPercentage().doubleValue());
                    data.put("date", new Date());

                    staffClient.addStaffCommission(auth, data);
                } catch (Exception e) {
                    System.err.println("Failed to record staff commission: " + e.getMessage());
                }
            });
        }
    }

    private String syncCustomerAndGetId(String auth, Bill bill) {
        if (bill.getCustomerPhone() != 0) {
            try {
                CustomerDTO customerDTO = CustomerDTO.builder()
                        .name(bill.getCustomerName())
                        .phone(String.valueOf(bill.getCustomerPhone()))
                        .email(bill.getCustomerEmail())
                        .address(bill.getCustomerAddress())
                        .gstNo(bill.getCustomerGst())
                        .build();

                Map<String, String> response = vendorClient.addCustomer(auth, customerDTO);
                return response.get("id");
            } catch (Exception e) {
                System.err.println("Sync failed: " + e.getMessage());
            }
        }
        return null;
    }

    private void recordCustomerTransaction(String auth, Bill bill, String customerId) {
        try {
            BigDecimal amountPaid = bill.getAmountPaid() != null ? bill.getAmountPaid() : bill.getFinalAmount();
            BillTransactionDTO dto = BillTransactionDTO.builder()
                    .billId(bill.getId())
                    .amount(bill.getFinalAmount())
                    .paidAmount(amountPaid)
                    .date(new Date())
                    .paymentMethod(bill.getPaymentMethod())
                    .build();
            vendorClient.addCustomerTransaction(auth, customerId, dto);
        } catch (Exception e) {
            System.err.println("Txn failed: " + e.getMessage());
        }
    }

    private void recordCommission(String auth, Bill bill) {
        if (bill.getBrokerId() != null && !bill.getBrokerId().isEmpty() &&
                bill.getCommissionAmount() != null && bill.getCommissionAmount().doubleValue() > 0) {
            CompletableFuture.runAsync(() -> {
                try {
                    CommissionDTO comm = CommissionDTO.builder()
                            .billId(bill.getId())
                            .brokerId(bill.getBrokerId())
                            .amount(bill.getCommissionAmount().doubleValue())
                            .status("UNPAID")
                            .date(new Date())
                            .build();
                    vendorClient.addCommission(auth, comm);
                } catch (Exception e) {
                    System.err.println("Broker comm failed: " + e.getMessage());
                }
            });
        }
    }

    private void adjustStockBulkParallel(String auth, List<BillDetails> items, boolean deduct) {
        List<BillDetails> successfulUpdates = Collections.synchronizedList(new ArrayList<>());
        try {
            List<CompletableFuture<Void>> futures = items.stream()
                    .filter(item -> !"TRANSPORT_CHARGE".equals(item.getProductId()))
                    .map(item -> CompletableFuture.runAsync(() -> {
                        double change = deduct ? -item.getQuantity() : item.getQuantity();
                        productClient.updateProductStock(auth, item.getProductId(), change);
                        successfulUpdates.add(item);
                    }))
                    .collect(Collectors.toList());
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        } catch (Exception e) {
            successfulUpdates.forEach(item -> {
                double rev = deduct ? item.getQuantity() : -item.getQuantity();
                productClient.updateProductStock(auth, item.getProductId(), rev);
            });
            throw new RuntimeException("Stock update failed.");
        }
    }

    private String generateSequentialId() throws Exception {
        DocumentReference ref = firestore.collection("_counters").document("bills");
        return firestore.runTransaction(t -> {
            DocumentSnapshot snap = t.get(ref).get();
            long next = (snap.exists() && snap.getLong("current") != null) ? snap.getLong("current") : 0;
            next++;
            t.set(ref, Map.of("current", next));
            return String.format("SKA 26-27-%03d", next);
        }).get();
    }

    
    public List<Bill> getAllBills() throws Exception {
        return firestore.collection(COL).orderBy("createdAt", Query.Direction.DESCENDING).get().get()
                .toObjects(Bill.class);
    }

    public List<Bill> getBillsByRange(Date start, Date end) throws Exception {
        return firestore.collection(COL).whereGreaterThanOrEqualTo("createdAt", start)
                .whereLessThanOrEqualTo("createdAt", end).get().get().toObjects(Bill.class);
    }

    
    public void cancelBill(String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL).document(id);
        DocumentSnapshot snap = docRef.get().get();
        if (!snap.exists())
            throw new NoSuchElementException("Bill not found");
        Bill bill = snap.toObject(Bill.class);
        String currentStatus = bill.getStatus() != null ? bill.getStatus() : "PAID";
        // Store previous status so it can be restored on uncancel (only if not already cancelled)
        if (!"CANCELLED".equals(currentStatus)) {
            docRef.update("previousStatus", currentStatus).get();
        }
        docRef.update("status", "CANCELLED").get();
    }

    
    public void uncancelBill(String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL).document(id);
        DocumentSnapshot snap = docRef.get().get();
        if (!snap.exists())
            throw new NoSuchElementException("Bill not found");
        Bill bill = snap.toObject(Bill.class);
        String restoreStatus = (bill.getPreviousStatus() != null && !bill.getPreviousStatus().isEmpty())
                ? bill.getPreviousStatus()
                : "PAID";
        Map<String, Object> updates = new HashMap<>();
        updates.put("status", restoreStatus);
        updates.put("previousStatus", null);
        docRef.update(updates).get();
    }

    
    public void cancelBillPlaceholder(String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL).document(id);
        DocumentSnapshot snap = docRef.get().get();
        if (snap.exists()) {
            // Existing bill — cancel normally (preserves previous status)
            cancelBill(id);
            return;
        }
        // No bill exists for this number — create a lightweight cancelled placeholder
        // with no stock/customer/commission side effects.
        Map<String, Object> data = new HashMap<>();
        data.put("id", id);
        data.put("status", "CANCELLED");
        data.put("paymentMethod", "CANCELLED");
        data.put("previousStatus", null);
        data.put("createdAt", new Date());
        data.put("items", Collections.emptyList());
        data.put("finalAmount", BigDecimal.ZERO);
        docRef.set(data).get();
    }

    
    public void updateStatus(String id, String status) throws Exception {
        firestore.collection(COL).document(id).update("status", status).get();
    }

    
    public void deleteBill(String auth, String id) throws Exception {
        DocumentReference docRef = firestore.collection(COL).document(id);
        DocumentSnapshot snap = docRef.get().get();
        if (snap.exists()) {
            Bill bill = snap.toObject(Bill.class);
            if (bill != null && bill.getItems() != null && !bill.getItems().isEmpty()) {
                adjustStockBulkParallel(auth, bill.getItems(), false); // Restore stock
            }
            // Delete the bill entirely so the ID can be reused
            docRef.delete().get();
            // Try to delete transactions and commissions asynchronously
            CompletableFuture.runAsync(() -> {
                try {
                    vendorClient.deleteCustomerTransactionsByBillId(auth, id);
                } catch(Exception e) { log.warn("Failed to delete customer transactions for bill {}", id); }
                try {
                    vendorClient.deleteCommissionsByBillId(auth, id);
                } catch(Exception e) { log.warn("Failed to delete broker commissions for bill {}", id); }
                try {
                    staffClient.deleteStaffCommissionsByBillId(auth, id);
                } catch(Exception e) { log.warn("Failed to delete staff commissions for bill {}", id); }
            });
        }
    }

    public List<Bill> getBillsByCustomerInfo(String name, Long phone) throws Exception {
        return new ArrayList<>();
    }

    public Bill processReturnOrExchange(String auth, String id, Bill returnReq) throws Exception {
        return returnReq;
    }
}
