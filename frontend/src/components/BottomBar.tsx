import {
  Paper,
  Box,
  TextField,
  Button,
  Stack,
  Autocomplete,
  Chip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  createFilterOptions,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import FlagIcon from '@mui/icons-material/Flag'
import type { PlanMode } from '../hooks/usePlanState'
import type { PubCatalogItem } from '../services/api'
import { formatPubAddress, pubPostcode, pubSearchText } from '../utils/pubAddress'

interface BottomBarProps {
  startPoint: [number, number] | null
  endPoint: [number, number] | null
  numPubs: number
  onNumPubsChange: (numPubs: number) => void
  onPlan: () => void
  onClear: () => void
  loading: boolean
  mode: PlanMode
  onModeChange: (mode: PlanMode) => void
  pubCatalog: PubCatalogItem[]
  selectedPubIds: string[]
  onSelectedPubIdsChange: (pubIds: string[]) => void
  catalogLoading: boolean
  selectingEnd: boolean
  onPickEnd: () => void
  onClearEnd: () => void
}

const MAX_SELECTED_PUBS = 25

// Match on street and postcode too, so pubs sharing a name can be told apart
const filterPubs = createFilterOptions<PubCatalogItem>({
  stringify: pubSearchText,
})

const BottomBar: React.FC<BottomBarProps> = ({
  startPoint,
  endPoint,
  numPubs,
  onNumPubsChange,
  onPlan,
  onClear,
  loading,
  mode,
  onModeChange,
  pubCatalog,
  selectedPubIds,
  onSelectedPubIdsChange,
  catalogLoading,
  selectingEnd,
  onPickEnd,
  onClearEnd,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const pubById = new Map(pubCatalog.map((pub) => [pub.id, pub]))
  const selectedPubs = selectedPubIds
    .map((id) => pubById.get(id))
    .filter((pub): pub is PubCatalogItem => Boolean(pub))

  const canPlan =
    Boolean(startPoint) &&
    (mode === 'corridor' ? Boolean(endPoint) : selectedPubIds.length > 0)

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mt: 'auto',
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #e0e0e0',
      }}
    >
      <Stack gap={1.5} alignItems="center">
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, next: PlanMode | null) => next && onModeChange(next)}
          sx={{ backgroundColor: 'white' }}
        >
          <ToggleButton value="corridor">Plan for me</ToggleButton>
          <ToggleButton value="select">Pick pubs</ToggleButton>
        </ToggleButtonGroup>

        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2,
            width: '100%',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'center',
          }}
        >
          {mode === 'corridor' ? (
            <TextField
              type="number"
              inputProps={{ min: 1, max: 20 }}
              value={numPubs}
              onChange={(e) => onNumPubsChange(parseInt(e.target.value))}
              label="Number of Pubs"
              size="small"
              sx={{
                width: isMobile ? '100%' : 120,
                '& .MuiInputBase-root': {
                  backgroundColor: 'white',
                },
              }}
            />
          ) : (
            <>
              <Autocomplete
                multiple
                disableCloseOnSelect
                size="small"
                options={pubCatalog}
                loading={catalogLoading}
                value={selectedPubs}
                getOptionLabel={(pub) => pub.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                getOptionDisabled={(pub) =>
                  selectedPubIds.length >= MAX_SELECTED_PUBS && !selectedPubIds.includes(pub.id)
                }
                onChange={(_, pubs) => onSelectedPubIdsChange(pubs.map((pub) => pub.id))}
                limitTags={3}
                filterOptions={filterPubs}
                renderOption={(props, pub) => {
                  const { key, ...optionProps } = props
                  const address = formatPubAddress(pub)
                  return (
                    <li key={key} {...optionProps}>
                      <Box>
                        <Typography variant="body2">{pub.name}</Typography>
                        {address && (
                          <Typography variant="caption" color="text.secondary">
                            {address}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )
                }}
                renderTags={(pubs, getTagProps) =>
                  pubs.map((pub, index) => {
                    const { key, ...tagProps } = getTagProps({ index })
                    const postcode = pubPostcode(pub)
                    return (
                      <Chip
                        key={key}
                        label={postcode ? `${pub.name} (${postcode})` : pub.name}
                        size="small"
                        {...tagProps}
                      />
                    )
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Pubs to visit"
                    placeholder={selectedPubIds.length ? '' : 'Search pubs'}
                    helperText={
                      selectedPubIds.length >= MAX_SELECTED_PUBS
                        ? `Maximum ${MAX_SELECTED_PUBS} pubs`
                        : 'Search by name, street or postcode — or tap pubs on the map'
                    }
                  />
                )}
                sx={{
                  width: isMobile ? '100%' : 420,
                  '& .MuiInputBase-root': { backgroundColor: 'white' },
                }}
              />
              <Button
                variant={selectingEnd ? 'contained' : 'outlined'}
                color="secondary"
                startIcon={<FlagIcon />}
                onClick={endPoint ? onClearEnd : onPickEnd}
                fullWidth={isMobile}
                size={isMobile ? 'medium' : 'small'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {endPoint
                  ? 'Clear finish'
                  : selectingEnd
                    ? 'Tap the map'
                    : 'Set finish (optional)'}
              </Button>
            </>
          )}

          <Stack
            direction={isMobile ? 'column' : 'row'}
            gap={1}
            sx={{ width: isMobile ? '100%' : 'auto' }}
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<DirectionsWalkIcon />}
              onClick={onPlan}
              disabled={!canPlan || loading}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'small'}
            >
              {loading ? 'Planning...' : 'Plan'}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ClearIcon />}
              onClick={onClear}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'small'}
            >
              Clear
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}

export default BottomBar
