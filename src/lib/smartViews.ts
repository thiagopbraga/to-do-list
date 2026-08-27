import {
  CalendarCheckIcon,
  CalendarIcon,
  CircleCheckIcon,
  ListIcon,
} from '../components/icons'
import type { SmartView } from '../types/task'

export const SMART_VIEW_META: Record<
  SmartView,
  { label: string; icon: typeof CalendarIcon }
> = {
  today: { label: 'Hoje', icon: CalendarCheckIcon },
  scheduled: { label: 'Agendadas', icon: CalendarIcon },
  all: { label: 'Todas', icon: ListIcon },
  done: { label: 'Concluídas', icon: CircleCheckIcon },
}
