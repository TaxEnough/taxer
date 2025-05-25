import * as React from "react"
import { DayPicker, type DayClickEventHandler } from "react-day-picker"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { format, getMonth, getYear, setMonth, setYear, isSameDay } from "date-fns"
import { enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(props.defaultMonth || new Date());
  const [currentYear, setCurrentYear] = React.useState<number>(currentMonth.getFullYear());
  const [internalSelectedDay, setInternalSelectedDay] = React.useState<Date | undefined>(undefined);
  
  // Track last selected day to prevent double selection
  const lastSelectedDayRef = React.useRef<Date | null>(null);
  
  // Generate years for dropdown (from 1900 to current year + 10)
  const thisYear = new Date().getFullYear();
  const years = Array.from(
    { length: thisYear - 1900 + 11 },
    (_, i) => 1900 + i
  );
  
  // Months for dropdown
  const months = [
    "January", "February", "March", "April", 
    "May", "June", "July", "August", 
    "September", "October", "November", "December"
  ];
  
  // Handle year change
  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setCurrentYear(newYear);
    
    const newDate = new Date(currentMonth);
    newDate.setFullYear(newYear);
    setCurrentMonth(newDate);
    
    if (props.onMonthChange) {
      props.onMonthChange(newDate);
    }
  };
  
  // Handle month change
  const handleMonthChange = (month: string) => {
    const monthIndex = months.findIndex(m => m === month);
    if (monthIndex !== -1) {
      const newDate = new Date(currentMonth);
      newDate.setMonth(monthIndex);
      setCurrentMonth(newDate);
      
      if (props.onMonthChange) {
        props.onMonthChange(newDate);
      }
    }
  };
  
  // Custom day click handler to prevent double-clicks
  const handleDayClick: DayClickEventHandler = (day, modifiers, e) => {
    // If it's a disabled day, do nothing
    if (modifiers.disabled) return;
    
    // Check if it's the same day that was just selected
    if (lastSelectedDayRef.current && isSameDay(day, lastSelectedDayRef.current)) {
      // Prevent default to stop DayPicker from processing the click
      e.preventDefault();
      return;
    }
    
    // Update our reference to the last selected day
    lastSelectedDayRef.current = day;
    setInternalSelectedDay(day);
    
    // Let the original handler run for anything else
    if (props.onDayClick) {
      props.onDayClick(day, modifiers, e);
    }
  };
  
  // Jump to today
  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setCurrentYear(today.getFullYear());
    
    // Update our reference
    lastSelectedDayRef.current = today;
    setInternalSelectedDay(today);
    
    if (props.onMonthChange) {
      props.onMonthChange(today);
    }
    
    // Forward to original onSelect if it exists
    const onSelectHandler = (props as any).onSelect;
    if (typeof onSelectHandler === 'function') {
      onSelectHandler(today);
    }
  };
  
  // Update current month when month changes
  React.useEffect(() => {
    if (props.month) {
      setCurrentMonth(props.month);
      setCurrentYear(props.month.getFullYear());
    }
  }, [props.month]);
  
  return (
    <div className="rdp-wrapper bg-white rounded-lg shadow-md border border-gray-200 p-4 max-w-[350px]">
      <div className="flex items-center justify-between mb-4 space-x-2">
        <Select 
          value={months[getMonth(currentMonth)]} 
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="w-[110px] h-9 bg-white border border-gray-200 text-sm">
            <SelectValue placeholder={months[getMonth(currentMonth)]} />
          </SelectTrigger>
          <SelectContent className="max-h-[15rem] bg-white">
            {months.map((month) => (
              <SelectItem key={month} value={month} className="text-sm">
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={currentYear.toString()} 
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-[80px] h-9 bg-white border border-gray-200 text-sm">
            <SelectValue placeholder={currentYear.toString()} />
          </SelectTrigger>
          <SelectContent className="max-h-[15rem] bg-white">
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()} className="text-sm">
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <style jsx global>{`
        /* Force table layout with fixed cells */
        .calendar-root table {
          border-collapse: separate;
          border-spacing: 2px;
          width: 100%;
          table-layout: fixed;
        }
        
        /* Header cells for weekday names */
        .calendar-root th {
          text-align: center;
          font-size: 0.8rem;
          font-weight: 500;
          padding: 4px 0;
          color: #6b7280;
          height: 28px;
        }
        
        /* Day cells */
        .calendar-root td {
          text-align: center;
          padding: 0;
          height: 50px; /* Increased cell height to 50px */
          position: relative;
          width: 50px;  /* Ensure cells are exactly 50px wide */
        }
        
        /* Day buttons */
        .calendar-root button.day {
          position: absolute;
          top: 0;
          left: 0;
          width: 100% !important;
          height: 100% !important;
          border-radius: 4px;
          padding: 0;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          background: none;
          margin: 0;
        }
        
        .calendar-root button.day:hover:not(.selected) {
          background-color: #f3f4f6;
        }
        
        .calendar-root button.day.selected {
          background-color: #22c55e;
          color: #fff;
        }
        
        .calendar-root button.day.today:not(.selected) {
          border: 1px solid hsl(var(--primary));
          background-color: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }
        
        .calendar-root button.day.outside {
          color: #9ca3af;
          opacity: 0.5;
        }
        
        .calendar-root button.day.disabled {
          color: #d1d5db;
          cursor: not-allowed;
        }
      `}</style>
      
      <div className="calendar-container overflow-hidden">
    <DayPicker
      showOutsideDays={showOutsideDays}
          className={cn("p-0 calendar-root", className)}
          locale={enUS}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          onDayClick={handleDayClick}
          modifiersClassNames={{
            selected: "selected", 
            today: "today",
            outside: "outside",
            disabled: "disabled"
          }}
      classNames={{
            months: "flex flex-col",
            month: "",
            caption: "hidden", // Hide the default caption
            nav: "flex items-center justify-between px-1 py-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
              "h-8 w-8 bg-white border border-gray-200 p-0 hover:bg-gray-100 flex items-center justify-center"
        ),
            nav_button_previous: "ml-1",
            nav_button_next: "mr-1",
            table: "w-full border-collapse",
            head_row: "",
            head_cell: "",
            row: "",
            cell: "",
            day: "day",
            day_selected: "selected",
            day_today: "today",
            day_outside: "outside",
            day_disabled: "disabled",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
      </div>
      
      <div className="mt-3 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToToday}
          className="text-xs bg-white border border-gray-200 hover:bg-gray-100 flex items-center gap-1"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span>Select Today</span>
        </Button>
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar } 