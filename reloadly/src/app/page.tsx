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
  createTheme,
  ThemeProvider,
} from '@mui/material';
import { debounce } from 'lodash';
import {
  getCountries,
  getOperators,
  purchaseData,
  checkBalance,
  CountryInfo,
  DataPlan,
} from '../libs/reloadlyApi';

// Custom Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#F3D514', // Yellow for buttons and accents
      contrastText: '#020916', // Navy blue for text on buttons
    },
    background: {
      default: '#020916', // Navy blue background
    },
    text: {
      primary: '#F3D514', // Yellow text
      secondary: '#FFFFFF', // White for secondary text
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#F3D514',
            },
            '&:hover fieldset': {
              borderColor: '#FFFFFF',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#F3D514',
            },
            backgroundColor: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white
            color: '#F3D514',
          },
          '& .MuiInputLabel-root': {
            color: '#F3D514',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#F3D514',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#F3D514',
            },
            '&:hover fieldset': {
              borderColor: '#FFFFFF',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#F3D514',
            },
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#F3D514',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: '#F3D514',
          color: '#020916',
          '&:hover': {
            backgroundColor: '#FFFFFF',
            color: '#020916',
          },
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 'bold',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#020916',
          color: '#F3D514',
          border: '1px solid #F3D514',
          borderRadius: '8px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: '#F3D514',
          border: '1px solid #F3D514',
        },
      },
    },
  },
});

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

interface ExtendedOperatorResponse extends OperatorResponse {
  fixedAmounts?: number[];
  fixedAmountsDescriptions?: Record<string, string>;
  destinationCurrencyCode?: string;
}

interface PurchaseResult {
  success: boolean;
  message: string;
  transactionId?: string;
}

const DataPurchaseForm = () => {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [operators, setOperators] = useState<ExtendedOperatorResponse[]>([]);
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loadingStates, setLoadingStates] = useState({
    countries: false,
    operators: false,
    plans: false,
    balance: false,
    submitting: false,
  });
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
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

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, countries: true, balance: true }));
    setApiError(null);
    try {
      const [countriesResponse, balanceData] = await Promise.all([
        getCountries(),
        checkBalance(),
      ]);

      const countriesData = Array.isArray(countriesResponse)
        ? countriesResponse
        : countriesResponse.content || countriesResponse.data || [];

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load initial data';
      console.error('Initial data load error:', error);
      setApiError(
        errorMessage.includes('406')
          ? 'API configuration error: Invalid response format from Reloadly. Please check API settings.'
          : errorMessage.includes('Authentication failed')
          ? 'Authentication error: Please check your Reloadly API credentials.'
          : errorMessage
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
      if (!countryCode) return;

      setLoadingStates(prev => ({ ...prev, operators: true }));
      setApiError(null);
      try {
        const data = await getOperators(countryCode);
        const operatorsData = Array.isArray(data) ? data : [];

        const validOperators = operatorsData.filter((op: ExtendedOperatorResponse) =>
          (op.fixedAmounts?.length ?? 0) > 0 ||
          (op.fixedAmountsDescriptions && Object.keys(op.fixedAmountsDescriptions).length > 0)
        );

        setOperators(validOperators);
        setValue('operator', '');
        setValue('plan', '');
        setPlans([]);

        if (validOperators.length === 0) {
          setApiError('No operators with data plans available for the selected country');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load operators';
        console.error('Operators fetch error:', error);
        setApiError(errorMessage);
      } finally {
        setLoadingStates(prev => ({ ...prev, operators: false }));
      }
    }, 500),
    [setValue]
  );

  // Debounced plan fetching
  const fetchPlans = useCallback(
    debounce(async (operatorId: string) => {
      if (!operatorId) return;

      setLoadingStates(prev => ({ ...prev, plans: true }));
      setApiError(null);
      try {
        const operator = operators.find(op => op.operatorId.toString() === operatorId);

        if (!operator?.fixedAmounts || !operator.fixedAmountsDescriptions) {
          setApiError('No data plans available for this operator');
          setPlans([]);
          setValue('plan', '');
          return;
        }

        const generatedPlans: DataPlan[] = operator.fixedAmounts.map((amount: number) => {
          const description = operator.fixedAmountsDescriptions?.[amount.toFixed(2)] || `${amount} Plan`;
          const match = description.match(/(\d+\.?\d*?\s*(?:GB|MB))[\s\w]*?(?:\((.*?)\)|(\d+\s*(?:day|month)s?))/i);
          const dataAmount = match ? match[1] : 'Unknown';
          const validity = match ? (match[2] || match[3] || 'Unknown') : 'Unknown';

          return {
            operatorId: operator.operatorId,
            operatorName: operator.name,
            planId: amount.toString(),
            planName: description,
            amount,
            currency: operator.destinationCurrencyCode || 'NGN',
            dataAmount,
            validity,
          };
        });

        setPlans(generatedPlans);
        setValue('plan', '');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load data plans';
        console.error('Data plans fetch error:', error);
        setApiError(errorMessage);
      } finally {
        setLoadingStates(prev => ({ ...prev, plans: false }));
      }
    }, 500),
    [operators, setValue]
  );

  useEffect(() => {
    if (selectedCountry) {
      fetchOperators(selectedCountry);
    }
  }, [selectedCountry, fetchOperators]);

  useEffect(() => {
    if (selectedOperator) {
      fetchPlans(selectedOperator);
    }
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

      reset({
        country: countries.find(c => c.isoName === 'NG') ? 'NG' : '',
        operator: '',
        plan: '',
        phone: '',
      });
      setOperators([]);
      setPlans([]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      console.error('Purchase error:', error);
      setApiError(errorMessage);
    } finally {
      setLoadingStates(prev => ({ ...prev, submitting: false, balance: false }));
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ backgroundColor: '#020916', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
        <Typography
          variant="h3"
          sx={{
            color: '#fff',
            fontWeight: 'bold',
            mb: 4,
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          Welcome to disudata.com
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{
            maxWidth: 500,
            width: '100%',
            p: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Typography variant="h5" sx={{ color: '#F3D514', mb: 2 }}>
            Data Purchase{' '}
            {balance !== null && !loadingStates.balance && `(Balance: ₦${balance.toFixed(2)})`}
            {loadingStates.balance && <CircularProgress size={16} sx={{ ml: 1, color: '#F3D514' }} />}
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
                sx={{ borderColor: '#F3D514', color: '#F3D514' }}
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
                <Typography variant="body2" sx={{ mt: 1, color: '#F3D514' }}>
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
            >
              {loadingStates.countries ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ color: '#F3D514' }} />
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
              <Typography variant="caption" sx={{ color: '#F3D514' }}>
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
              {loadingStates.operators ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ color: '#F3D514' }} />
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
              <Typography variant="caption" sx={{ color: '#F3D514' }}>
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
              {loadingStates.plans ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ color: '#F3D514' }} />
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
              <Typography variant="caption" sx={{ color: '#F3D514' }}>
                {errors.plan.message}
              </Typography>
            )}
          </FormControl>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loadingStates.submitting || !isValid || countries.length === 0}
          >
            {loadingStates.submitting ? <CircularProgress size={24} sx={{ color: '#020916' }} /> : 'Purchase Data'}
          </Button>

          <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
            <DialogTitle sx={{ color: '#F3D514' }}>Confirm Purchase</DialogTitle>
            <DialogContent>
              {selectedPlan && (
                <>
                  <Typography sx={{ color: '#F3D514' }}>
                    You are about to purchase: <strong>{selectedPlan.planName}</strong>
                  </Typography>
                  <Typography sx={{ color: '#F3D514' }}>
                    Amount: <strong>₦{selectedPlan.amount}</strong>
                  </Typography>
                  <Typography sx={{ color: '#F3D514' }}>
                    Data: <strong>{selectedPlan.dataAmount}</strong>
                  </Typography>
                  <Typography sx={{ color: '#F3D514' }}>
                    Validity: <strong>{selectedPlan.validity}</strong>
                  </Typography>
                  <Typography sx={{ color: '#F3D514' }}>
                    For number: <strong>{watch('phone')}</strong>
                  </Typography>
                  {balance !== null && (
                    <Typography sx={{ color: balance >= selectedPlan.amount ? '#F3D514' : '#FF5555' }}>
                      Balance: ₦{balance.toFixed(2)}
                      {balance < selectedPlan.amount && ' (Insufficient balance)'}
                    </Typography>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmOpen(false)} sx={{ color: '#F3D514' }}>
                Cancel
              </Button>
              <Button
                onClick={confirmPurchase}
                variant="contained"
                disabled={loadingStates.submitting || (balance !== null && balance < (selectedPlan?.amount || 0))}
              >
                {loadingStates.submitting ? <CircularProgress size={24} sx={{ color: '#020916' }} /> : 'Confirm'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default DataPurchaseForm;