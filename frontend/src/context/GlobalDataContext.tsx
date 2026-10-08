import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { productApi, customerApi, vendorApi, staffApi, brokerApi, billingApi, Product, Customer, Vendor, Staff, Broker, Bill } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useCachedResource } from '@/hooks/useCachedResource';

const DAY_TTL = 24 * 60 * 60 * 1000;

interface GlobalDataContextType {
    products: Product[];
    customers: Customer[];
    vendors: Vendor[];
    staff: Staff[];
    brokers: Broker[];
    bills: Bill[];
    loading: boolean;
    isSyncing: boolean;
    refreshAll: () => Promise<void>;
    refreshProducts: () => Promise<void>;
    refreshCustomers: () => Promise<void>;
    refreshVendors: () => Promise<void>;
    refreshStaff: () => Promise<void>;
    refreshBrokers: () => Promise<void>;
    refreshBills: () => Promise<void>;
    mutateProducts: (updater: Product[] | ((prev: Product[]) => Product[])) => void;
    mutateCustomers: (updater: Customer[] | ((prev: Customer[]) => Customer[])) => void;
    mutateVendors: (updater: Vendor[] | ((prev: Vendor[]) => Vendor[])) => void;
    mutateStaff: (updater: Staff[] | ((prev: Staff[]) => Staff[])) => void;
    mutateBrokers: (updater: Broker[] | ((prev: Broker[]) => Broker[])) => void;
    mutateBills: (updater: Bill[] | ((prev: Bill[]) => Bill[])) => void;
}

const GlobalDataContext = createContext<GlobalDataContextType>({
    products: [],
    customers: [],
    vendors: [],
    staff: [],
    brokers: [],
    bills: [],
    loading: true,
    isSyncing: false,
    refreshAll: async () => { },
    refreshProducts: async () => { },
    refreshCustomers: async () => { },
    refreshVendors: async () => { },
    refreshStaff: async () => { },
    refreshBrokers: async () => { },
    refreshBills: async () => { },
    mutateProducts: () => { },
    mutateCustomers: () => { },
    mutateVendors: () => { },
    mutateStaff: () => { },
    mutateBrokers: () => { },
    mutateBills: () => { },
});

export const GlobalDataProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();

    const {
        data: products,
        loading: loadingProducts,
        isSyncing: syncingProducts,
        refresh: refreshProducts,
        mutate: rawMutateProducts
    } = useCachedResource<Product[]>('global_products', productApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: customers,
        loading: loadingCustomers,
        isSyncing: syncingCustomers,
        refresh: refreshCustomers,
        mutate: mutateCustomers
    } = useCachedResource<Customer[]>('global_customers', customerApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: vendors,
        loading: loadingVendors,
        isSyncing: syncingVendors,
        refresh: refreshVendors,
        mutate: mutateVendors
    } = useCachedResource<Vendor[]>('global_vendors', vendorApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: staff,
        loading: loadingStaff,
        isSyncing: syncingStaff,
        refresh: refreshStaff,
        mutate: mutateStaff
    } = useCachedResource<Staff[]>('global_staff', staffApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: brokers,
        loading: loadingBrokers,
        isSyncing: syncingBrokers,
        refresh: refreshBrokers,
        mutate: mutateBrokers
    } = useCachedResource<Broker[]>('global_brokers', brokerApi.getAll, { skip: !user, initialData: [], ttl: DAY_TTL });

    const {
        data: bills,
        loading: loadingBills,
        isSyncing: syncingBills,
        refresh: refreshBills,
        mutate: mutateBills
    } = useCachedResource<Bill[]>('global_bills', billingApi.getAll, { skip: !user, initialData: [], ttl: 0 }); // Fetch fresh bills on mount

    const loading = loadingProducts || loadingCustomers || loadingVendors || loadingStaff || loadingBrokers || loadingBills;
    const isSyncing = syncingProducts || syncingCustomers || syncingVendors || syncingStaff || syncingBrokers || syncingBills;

    const refreshAll = useCallback(async () => {
        await Promise.allSettled([
            refreshProducts(),
            refreshCustomers(),
            refreshVendors(),
            refreshStaff(),
            refreshBrokers(),
            refreshBills(),
        ]);
    }, [refreshProducts, refreshCustomers, refreshVendors, refreshStaff, refreshBrokers, refreshBills]);

    // rawMutateProducts now supports function updater pattern natively

    const value = useMemo(() => ({
        products: products || [],
        customers: customers || [],
        vendors: vendors || [],
        staff: staff || [],
        brokers: brokers || [],
        bills: bills || [],
        loading,
        isSyncing,
        refreshAll,
        refreshProducts,
        refreshCustomers,
        refreshVendors,
        refreshStaff,
        refreshBrokers,
        refreshBills,
        mutateProducts: rawMutateProducts,
        mutateCustomers,
        mutateVendors,
        mutateStaff,
        mutateBrokers,
        mutateBills,
    }), [
        products, customers, vendors, staff, brokers, bills,
        loading, isSyncing,
        refreshAll, refreshProducts, refreshCustomers,
        refreshVendors, refreshStaff, refreshBrokers, refreshBills,
        rawMutateProducts, mutateCustomers, mutateVendors, mutateStaff, mutateBrokers, mutateBills,
    ]);

    return <GlobalDataContext.Provider value={value}>{children}</GlobalDataContext.Provider>;
};

export const useGlobalData = () => {
    return useContext(GlobalDataContext);
};
