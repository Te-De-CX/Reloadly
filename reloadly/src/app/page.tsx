'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { debounce } from 'lodash';
import {
  getCountries,
  getOperators,
  purchaseData,
  checkBalance,
  CountryInfo,
  NetworkOperator,
  DataPlan,
} from '../libs/reloadlyApi';

// Validation schema
const schema = z.object({
  phone: z
    .string()
    .regex(/^(080|081|090|091|070|071)\d{8}$/, 'Enter a valid Nigerian phone number')
    .length(11, 'Phone number must be 11 digits'),
  country: z.string().min(1, 'Country is required'),
  operator: z.string().min(1, 'Network is required'),
  plan: z.string().min(1, 'Data plan is required'),
});

type FormData = z.infer<typeof schema>;

const DataPurchaseForm = () => {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [operators, setOperators] = useState<NetworkOperator[]>([]);
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loadingStates, setLoadingStates] = useState({
    countries: false,
    operators: false,
    plans: false,
    balance: false,
    submitting: false,
  });
  const [purchaseResult, setPurchaseResult] = useState<{
    success: boolean;
    message: string;
    transactionId?: string;
  } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
    getValues,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: '', operator: '', plan: '', phone: '' },
  });

  const selectedCountry = watch('country');
  const selectedOperator = watch('operator');

  // Debug countries and selected values
  useEffect(() => {
    console.log('Countries state:', countries);
  }, [countries]);

  useEffect(() => {
    console.log('selectedCountry:', selectedCountry);
  }, [selectedCountry]);

  useEffect(() => {
    console.log('selectedOperator:', selectedOperator);
  }, [selectedOperator]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, countries: true, balance: true }));
    setApiError(null);
    try {
      const [countriesData, balanceData] = await Promise.all([
        getCountries(),
        checkBalance(),
      ]);

      console.log('Setting countries:', countriesData);
      setCountries(countriesData);
      setBalance(balanceData);

      if (countriesData.length > 0) {
        const nigeria = countriesData.find(c => c.isoName === 'NG');
        if (nigeria) {
          setValue('country', 'NG');
        }
      } else {
        setApiError('No countries available from API');
      }
    } catch (error: any) {
      console.error('Initial data load error:', error);
      setApiError(
        error.message.includes('406')
          ? 'API configuration error: Invalid response format from Reloadly. Please check API settings.'
          : error.message.includes('Authentication failed')
          ? 'Authentication error: Please check your Reloadly API credentials.'
          : error.message || 'Failed to load initial data. Please try again.'
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, countries: false, balance: false }));
    }
  }, [setValue]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Debounced operator fetching
  const fetchOperators = useCallback(
    debounce(async (countryCode: string) => {
      if (!countryCode) {
        console.log('fetchOperators: No countryCode provided');
        return;
      }
      console.log('fetchOperators: Fetching operators for countryCode:', countryCode);
      setLoadingStates(prev => ({ ...prev, operators: true }));
      setApiError(null);
      try {
        const data = await getOperators(countryCode);
        console.log('fetchOperators: Operators data:', data);
        // Filter operators with fixedAmounts or fixedAmountsDescriptions
        const validOperators = Array.isArray(data)
          ? data.filter(op => op.data && (op.fixedAmounts?.length > 0 || Object.keys(op.fixedAmountsDescriptions || {}).length > 0))
          : [];
        console.log('fetchOperators: Valid operators:', validOperators);
        setOperators(validOperators);
        setValue('operator', '');
        setValue('plan', '');
        setPlans([]);
        if (validOperators.length === 0 && countryCode) {
          setApiError('No operators with data plans available for the selected country');
        }
      } catch (error: any) {
        console.error('Operators fetch error:', error);
        setApiError(error.message || 'Failed to load operators');
      } finally {
        setLoadingStates(prev => ({ ...prev, operators: false }));
      }
    }, 500),
    [setValue]
  );

  // Debounced plan fetching using fixedAmounts and fixedAmountsDescriptions
  const fetchPlans = useCallback(
    debounce(async (operatorId: string) => {
      if (!operatorId) {
        console.log('fetchPlans: No operatorId provided');
        return;
      }
      console.log('fetchPlans: Fetching plans for operatorId:', operatorId);
      setLoadingStates(prev => ({ ...prev, plans: true }));
      setApiError(null);
      try {
        const operator = operators.find(op => op.operatorId.toString() === operatorId);
        if (!operator || !operator.fixedAmounts || !operator.fixedAmountsDescriptions) {
          setApiError('No data plans available for this operator');
          setPlans([]);
          setValue('plan', '');
          return;
        }

        const plans: DataPlan[] = operator.fixedAmounts.map(amount => {
          const description = operator.fixedAmountsDescriptions[amount.toFixed(2)] || `${amount} Plan`;
          // Parse description to extract dataAmount and validity (e.g., "N 50 50MB (1 day)")
          const match = description.match(/(\d+\.?\d*?\s*(?:GB|MB))[\s\w]*?(?:\((.*?)\)|(\d+\s*(?:day|month)s?))/i);
          const dataAmount = match ? match[1] : 'Unknown';
          const validity = match ? (match[2] || match[3] || 'Unknown') : 'Unknown';
          return {
            operatorId: operator.operatorId,
            operatorName: operator.name,
            planId: amount.toFixed(2), // Use amount as planId
            planName: description,
            amount,
            currency: operator.destinationCurrencyCode || 'NGN',
            dataAmount,
            validity,
          };
        });

        console.log('fetchPlans: Plans data:', plans);
        setPlans(plans);
        setValue('plan', '');
      } catch (error: any) {
        console.error('Data plans fetch error:', error);
        setApiError(error.message || 'Failed to load data plans');
      } finally {
        setLoadingStates(prev => ({ ...prev, plans: false }));
      }
    }, 500),
    [operators, setValue]
  );

  useEffect(() => {
    console.log('useEffect: selectedCountry changed:', selectedCountry);
    fetchOperators(selectedCountry);
  }, [selectedCountry, fetchOperators]);

  useEffect(() => {
    console.log('useEffect: selectedOperator changed:', selectedOperator);
    fetchPlans(selectedOperator);
  }, [selectedOperator, fetchPlans]);

  const onSubmit = (data: FormData) => {
    const plan = plans.find(p => p.planId === data.plan);
    if (plan) {
      setSelectedPlan(plan);
      setConfirmOpen(true);
    } else {
      setApiError('Selected plan not found');
    }
  };

  const confirmPurchase = async () => {
    setConfirmOpen(false);
    setLoadingStates(prev => ({ ...prev, submitting: true }));
    setPurchaseResult(null);
    setApiError(null);

    try {
      const values = getValues();
      const plan = plans.find(p => p.planId === values.plan);
      if (!plan) {
        throw new Error('Selected plan not found');
      }

      const result = await purchaseData(values.phone, Number(values.operator), plan.amount);
      setPurchaseResult({
        success: true,
        message: 'Data purchase successful!',
        transactionId: result.transactionId.toString(),
      });

      setLoadingStates(prev => ({ ...prev, balance: true }));
      const newBalance = await checkBalance();
      setBalance(newBalance);
      reset({ country: countries.find(c => c.isoName === 'NG') ? 'NG' : '', operator: '', plan: '', phone: '' });
      setOperators([]);
      setPlans([]);
    } catch (error: any) {
      console.error('Purchase error:', error);
      setApiError(error.message || 'Purchase failed');
    } finally {
      setLoadingStates(prev => ({ ...prev, submitting: false, balance: false }));
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Data Purchase{' '}
        {balance !== null && !loadingStates.balance && `(Balance: ₦${balance.toFixed(2)})`}
        {loadingStates.balance && <CircularProgress size={16} sx={{ ml: 1 }} />}
      </Typography>

      {apiError && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setApiError(null)}>
            {apiError}
          </Alert>
          <Button
            variant="outlined"
            onClick={() => {
              setApiError(null);
              loadInitialData();
            }}
          >
            Retry
          </Button>
        </Box>
      )}

      {purchaseResult && (
        <Alert
          severity={purchaseResult.success ? 'success' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setPurchaseResult(null)}
        >
          {purchaseResult.message}
          {purchaseResult.transactionId && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Transaction ID: {purchaseResult.transactionId}
            </Typography>
          )}
        </Alert>
      )}

      <TextField
        fullWidth
        margin="normal"
        label="Phone Number"
        variant="outlined"
        {...register('phone')}
        error={!!errors.phone}
        helperText={errors.phone?.message}
        placeholder="08123456789"
        inputProps={{ maxLength: 11 }}
      />

      <FormControl fullWidth margin="normal" error={!!errors.country}>
        <InputLabel>Country</InputLabel>
        <Select
          label="Country"
          {...register('country')}
          value={selectedCountry}
          disabled={loadingStates.countries || countries.length === 0}
          key={`country-select-${countries.length}`}
        >
          {console.log('Rendering Country Select, countries:', countries, 'length:', countries.length)}
          {loadingStates.countries ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
              Loading countries...
            </MenuItem>
          ) : countries.length > 0 ? (
            countries.map(country => (
              <MenuItem key={country.isoName} value={country.isoName}>
                {country.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>No countries available</MenuItem>
          )}
        </Select>
        {errors.country && (
          <Typography color="error" variant="caption">
            {errors.country.message}
          </Typography>
        )}
      </FormControl>

      <FormControl fullWidth margin="normal" error={!!errors.operator}>
        <InputLabel>Network</InputLabel>
        <Select
          label="Network"
          {...register('operator')}
          value={selectedOperator}
          disabled={!selectedCountry || loadingStates.operators || operators.length === 0}
        >
          {console.log('Rendering Network Select, operators:', operators, 'loading:', loadingStates.operators)}
          {loadingStates.operators ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
              Loading networks...
            </MenuItem>
          ) : operators.length > 0 ? (
            operators.map(operator => (
              <MenuItem key={operator.operatorId} value={operator.operatorId.toString()}>
                {operator.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              {selectedCountry ? 'No networks available' : 'Select a country first'}
            </MenuItem>
          )}
        </Select>
        {errors.operator && (
          <Typography color="error" variant="caption">
            {errors.operator.message}
          </Typography>
        )}
      </FormControl>

      <FormControl fullWidth margin="normal" error={!!errors.plan}>
        <InputLabel>Data Plan</InputLabel>
        <Select
          label="Data Plan"
          {...register('plan')}
          value={watch('plan')}
          disabled={!selectedOperator || loadingStates.plans || plans.length === 0}
        >
          {console.log('Rendering Data Plan Select, plans:', plans, 'loading:', loadingStates.plans)}
          {loadingStates.plans ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
              Loading plans...
            </MenuItem>
          ) : plans.length > 0 ? (
            plans.map(plan => (
              <MenuItem key={plan.planId} value={plan.planId}>
                {plan.planName} - ₦{plan.amount} ({plan.dataAmount} for {plan.validity})
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              {selectedOperator ? 'No plans available' : 'Select a network first'}
            </MenuItem>
          )}
        </Select>
        {errors.plan && (
          <Typography color="error" variant="caption">
            {errors.plan.message}
          </Typography>
        )}
      </FormControl>

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        sx={{ mt: 2 }}
        disabled={loadingStates.submitting || !isValid || countries.length === 0}
      >
        {loadingStates.submitting ? <CircularProgress size={24} /> : 'Purchase Data'}
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Purchase</DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <>
              <Typography>
                You are about to purchase: <strong>{selectedPlan.planName}</strong>
              </Typography>
              <Typography>
                Amount: <strong>₦{selectedPlan.amount}</strong>
              </Typography>
              <Typography>
                Data: <strong>{selectedPlan.dataAmount}</strong>
              </Typography>
              <Typography>
                Validity: <strong>{selectedPlan.validity}</strong>
              </Typography>
              <Typography>
                For number: <strong>{watch('phone')}</strong>
              </Typography>
              {balance !== null && (
                <Typography color={balance >= selectedPlan.amount ? 'success.main' : 'error.main'}>
                  Balance: ₦{balance.toFixed(2)}
                  {balance < selectedPlan.amount && ' (Insufficient balance)'}
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmPurchase}
            color="primary"
            variant="contained"
            disabled={loadingStates.submitting || (balance !== null && balance < (selectedPlan?.amount || 0))}
          >
            {loadingStates.submitting ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataPurchaseForm;