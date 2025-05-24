import * as React from "react"
import { DayPicker, type DayClickEventHandler } from "react-day-picker"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { format, getMonth, getYear, setMonth, setYear } from "date-fns"
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
  
  // Jump to today
  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setCurrentYear(today.getFullYear());
    
    if (props.onMonthChange) {
      props.onMonthChange(today);
    }
    
    // Try to select today if possible
    const defaultSelectHandler = (props as any).onSelect;
    if (defaultSelectHandler && typeof defaultSelectHandler === "function") {
      defaultSelectHandler(today);
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
    <div className="rdp-wrapper bg-white rounded-lg shadow-md border border-gray-200 p-4">
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
        .rdp-cell {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .rdp-day {
          width: 100% !important;
          height: 100% !important;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .rdp-day_today:not(.rdp-day_selected) {
          border: 1px solid var(--primary);
        }
      `}</style>
      
      <div className="calendar-container">
        <DayPicker
          showOutsideDays={showOutsideDays}
          className={cn("p-0", className)}
          locale={enUS}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          modifiersClassNames={{
            selected: "bg-primary text-primary-foreground", 
            today: "bg-accent text-accent-foreground"
          }}
          classNames={{
            months: "flex flex-col space-y-4",
            month: "space-y-0",
            caption: "hidden", // Hide the default caption
            nav: "flex items-center justify-between px-1 py-1",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-8 w-8 bg-white border border-gray-200 p-0 hover:bg-gray-100 flex items-center justify-center"
            ),
            nav_button_previous: "ml-1",
            nav_button_next: "mr-1",
            table: "w-full border-collapse",
            head_row: "grid grid-cols-7 w-full mb-1",
            head_cell: "text-center text-xs font-medium text-gray-500 py-2",
            row: "grid grid-cols-7 w-full mt-0 gap-0",
            cell: "w-full aspect-square p-0 relative focus-within:relative focus-within:z-20 text-center rdp-cell",
            day: "w-full h-full p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rdp-day",
            day_selected: "!bg-primary !text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground rdp-day_today",
            day_outside: "text-gray-400 opacity-50",
            day_disabled: "text-gray-300",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
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