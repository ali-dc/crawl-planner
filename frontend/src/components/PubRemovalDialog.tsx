import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material'
import type { Pub, AlternativePub, RouteEstimate } from '../services/api'

interface PubRemovalDialogProps {
  open: boolean
  pub: Pub | null
  pubIndex: number
  alternatives: AlternativePub[]
  routeWithoutPub: RouteEstimate | null
  loading: boolean
  onSelectAlternative: (pubId: string) => void
  onRemoveOnly: () => void
  onCancel: () => void
}

const PubRemovalDialog: React.FC<PubRemovalDialogProps> = ({
  open,
  pub,
  alternatives,
  routeWithoutPub,
  loading,
  onSelectAlternative,
  onRemoveOnly,
  onCancel,
}) => {
  if (!pub) return null

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Remove &quot;{pub.pub_name}&quot;?
        </Typography>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Suggested alternatives section */}
            {alternatives.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Suggested alternatives:
                </Typography>
                <List sx={{ p: 0 }}>
                  {alternatives.map((alt, index) => (
                    <div key={alt.pub_id}>
                      <ListItemButton
                        onClick={() => onSelectAlternative(alt.pub_id)}
                        sx={{
                          borderRadius: 1,
                          mb: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            borderColor: 'primary.main',
                            backgroundColor: 'primary.50',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {alt.pub_name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{ fontSize: '0.875rem' }}
                              >
                                {alt.added_distance_meters >= 0 ? '+' : ''}
                                {(alt.added_distance_meters / 1000).toFixed(2)} km
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Chip
                              label={alt.reason}
                              size="small"
                              sx={{
                                mt: 0.5,
                                height: 20,
                                fontSize: '0.75rem',
                              }}
                            />
                          }
                        />
                      </ListItemButton>
                      {index < alternatives.length - 1 && <Box sx={{ height: 4 }} />}
                    </div>
                  ))}
                </List>
              </>
            )}

            {/* Remove without replacement section */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Or remove without replacement:
            </Typography>
            {routeWithoutPub && (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Route will be {(routeWithoutPub.total_distance_meters / 1000).toFixed(2)} km
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onRemoveOnly}
          color="error"
          variant="outlined"
          disabled={loading}
        >
          Remove Only
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PubRemovalDialog
