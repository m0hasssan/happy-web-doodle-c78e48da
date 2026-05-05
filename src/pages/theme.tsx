import * as React from "react"
import {
  AlertCircleIcon,
  ArrowRightIcon,
  AtSignIcon,
  BellIcon,
  BoldIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  CreditCardIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  ItalicIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  LogOutIcon,
  MailIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  StarIcon,
  TrashIcon,
  UnderlineIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="border-border bg-card text-card-foreground scroll-mt-20 rounded-xl border p-6"
    >
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">{label}</p>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

const buttonVariants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const
const buttonSizes = ["xs", "sm", "default", "lg"] as const
const iconButtonSizes = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const
const badgeVariants = ["default", "secondary", "destructive", "outline"] as const

export function ThemePage() {
  const [progress, setProgress] = React.useState(40)
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [otp, setOtp] = React.useState("")
  const [sliderVal, setSliderVal] = React.useState([40])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">استعراض الكومبوننتس</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          كل كومبوننت في المشروع — RTL مفعّل عبر <code>DirectionProvider</code>، الأيقونات من lucide-react.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Section id="button" title="Button">
          <Row label="Variants">
            {buttonVariants.map((v) => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </Row>
          <Row label="Sizes">
            {buttonSizes.map((s) => (
              <Button key={s} size={s}>مقاس {s}</Button>
            ))}
          </Row>
          <Row label="Icon Sizes">
            {iconButtonSizes.map((s) => (
              <Button key={s} size={s} variant="outline" aria-label={s}>
                <PlusIcon />
              </Button>
            ))}
          </Row>
          <Row label="مع أيقونات">
            <Button><SendIcon />إرسال</Button>
            <Button variant="outline">التالي<ChevronRightIcon className="rtl:rotate-180" /></Button>
            <Button variant="secondary"><Loader2Icon className="animate-spin" />جاري التحميل</Button>
          </Row>
          <Row label="States">
            <Button>عادي</Button>
            <Button disabled>معطّل</Button>
            <Button aria-invalid="true">غير صالح</Button>
          </Row>
        </Section>

        <Section id="button-group" title="Button Group">
          <Row label="Horizontal">
            <ButtonGroup>
              <Button variant="outline">يمين</Button>
              <Button variant="outline">وسط</Button>
              <Button variant="outline">يسار</Button>
            </ButtonGroup>
          </Row>
          <Row label="مع separator و text">
            <ButtonGroup>
              <Button variant="outline"><PlusIcon /> إضافة</Button>
              <ButtonGroupSeparator />
              <Button variant="outline" size="icon" aria-label="more"><MoreHorizontalIcon /></Button>
            </ButtonGroup>
            <ButtonGroup>
              <ButtonGroupText>https://</ButtonGroupText>
              <Button variant="outline">example.com</Button>
            </ButtonGroup>
          </Row>
          <Row label="Vertical">
            <ButtonGroup orientation="vertical">
              <Button variant="outline"><HomeIcon /> الرئيسية</Button>
              <Button variant="outline"><UserIcon /> الحساب</Button>
              <Button variant="outline"><SettingsIcon /> الإعدادات</Button>
            </ButtonGroup>
          </Row>
        </Section>

        <Section id="badge" title="Badge">
          <Row label="Variants">
            {badgeVariants.map((v) => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </Row>
          <Row label="مع أيقونات">
            <Badge><CheckIcon /> مكتمل</Badge>
            <Badge variant="secondary"><BellIcon /> 3 إشعارات</Badge>
            <Badge variant="destructive"><AlertCircleIcon /> خطأ</Badge>
          </Row>
        </Section>

        <Section id="input" title="Input / Textarea / Label">
          <div className="grid max-w-lg gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">الاسم</Label>
              <Input id="t-name" placeholder="اكتب اسمك..." />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-email">البريد</Label>
              <Input id="t-email" type="email" placeholder="you@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-disabled">معطّل</Label>
              <Input id="t-disabled" placeholder="لا يمكن الكتابة" disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-invalid">غير صالح</Label>
              <Input id="t-invalid" placeholder="قيمة خاطئة" aria-invalid="true" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-area">رسالة</Label>
              <Textarea id="t-area" placeholder="اكتب رسالتك..." />
            </div>
          </div>
        </Section>

        <Section id="field" title="Field" description="مع label و description و error">
          <FieldSet>
            <FieldLegend>المعلومات الشخصية</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="f-fname">الاسم الأول</FieldLabel>
                <Input id="f-fname" placeholder="محمد" />
                <FieldDescription>اسمك كما يظهر للآخرين.</FieldDescription>
              </Field>
              <Field data-invalid>
                <FieldLabel htmlFor="f-email">البريد الإلكتروني</FieldLabel>
                <Input id="f-email" placeholder="you@example.com" aria-invalid="true" />
                <FieldError>البريد الإلكتروني غير صالح.</FieldError>
              </Field>
              <FieldSeparator />
              <Field orientation="horizontal">
                <Checkbox id="f-tos" />
                <FieldContent>
                  <FieldTitle>أوافق على الشروط والأحكام</FieldTitle>
                  <FieldDescription>تستطيع الإلغاء في أي وقت.</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </FieldSet>
        </Section>

        <Section id="input-group" title="Input Group">
          <div className="grid max-w-lg gap-3">
            <Field>
              <FieldLabel htmlFor="ig-search">بحث</FieldLabel>
              <InputGroup>
                <InputGroupAddon><SearchIcon /></InputGroupAddon>
                <InputGroupInput id="ig-search" placeholder="ابحث عن أي شيء..." />
                <InputGroupAddon align="inline-end">
                  <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="ig-mail">بريد</FieldLabel>
              <InputGroup>
                <InputGroupAddon><AtSignIcon /></InputGroupAddon>
                <InputGroupInput id="ig-mail" placeholder="username" />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>@example.com</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="ig-pass">كلمة السر</FieldLabel>
              <InputGroup>
                <InputGroupInput id="ig-pass" type="password" placeholder="••••••••" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton aria-label="toggle visibility"><EyeIcon /></InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="ig-textarea">رسالة</FieldLabel>
              <InputGroup>
                <InputGroupTextarea id="ig-textarea" placeholder="اكتب رسالتك..." />
                <InputGroupAddon align="block-end">
                  <InputGroupButton size="xs"><SendIcon /> إرسال</InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
        </Section>

        <Section id="input-otp" title="Input OTP">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <p className="text-muted-foreground text-sm">القيمة: {otp || "—"}</p>
        </Section>

        <Section id="checkbox-radio-switch" title="Checkbox / Radio / Switch">
          <Row label="Checkbox">
            <div className="flex items-center gap-2"><Checkbox id="c1" defaultChecked /><Label htmlFor="c1">مفعّل</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="c2" /><Label htmlFor="c2">غير مفعّل</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="c3" disabled /><Label htmlFor="c3">معطّل</Label></div>
          </Row>
          <Row label="Radio Group">
            <RadioGroup defaultValue="b" className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="a" id="r-a" /><Label htmlFor="r-a">خيار أ</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="b" id="r-b" /><Label htmlFor="r-b">خيار ب</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="c" id="r-c" /><Label htmlFor="r-c">خيار ج</Label></div>
            </RadioGroup>
          </Row>
          <Row label="Switch">
            <div className="flex items-center gap-2"><Switch id="s1" defaultChecked /><Label htmlFor="s1">إشعارات</Label></div>
            <div className="flex items-center gap-2"><Switch id="s2" /><Label htmlFor="s2">الوضع الليلي</Label></div>
          </Row>
        </Section>

        <Section id="select" title="Select / Native Select">
          <Row label="Select">
            <Select>
              <SelectTrigger className="w-56"><SelectValue placeholder="اختر فاكهة" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>فواكه</SelectLabel>
                  <SelectItem value="apple">تفاح</SelectItem>
                  <SelectItem value="banana">موز</SelectItem>
                  <SelectItem value="orange">برتقال</SelectItem>
                  <SelectItem value="grape">عنب</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Native Select">
            <NativeSelect className="w-56" defaultValue="">
              <option value="" disabled>اختر دولة</option>
              <NativeSelectOption value="eg">مصر</NativeSelectOption>
              <NativeSelectOption value="sa">السعودية</NativeSelectOption>
              <NativeSelectOption value="ae">الإمارات</NativeSelectOption>
            </NativeSelect>
          </Row>
        </Section>

        <Section id="slider-progress" title="Slider / Progress">
          <div className="space-y-3">
            <Label>Slider — قيمة: {sliderVal[0]}</Label>
            <Slider value={sliderVal} onValueChange={setSliderVal} max={100} step={1} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Progress — {progress}%</Label>
              <ButtonGroup>
                <Button size="xs" variant="outline" onClick={() => setProgress((p) => Math.max(0, p - 10))}>−</Button>
                <Button size="xs" variant="outline" onClick={() => setProgress((p) => Math.min(100, p + 10))}>+</Button>
              </ButtonGroup>
            </div>
            <Progress value={progress} />
          </div>
        </Section>

        <Section id="toggle" title="Toggle / Toggle Group">
          <Row label="Toggle">
            <Toggle aria-label="bold"><BoldIcon /></Toggle>
            <Toggle aria-label="italic" defaultPressed><ItalicIcon /></Toggle>
            <Toggle aria-label="underline" variant="outline"><UnderlineIcon /></Toggle>
          </Row>
          <Row label="Toggle Group (single)">
            <ToggleGroup type="single" defaultValue="bold">
              <ToggleGroupItem value="bold" aria-label="bold"><BoldIcon /></ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="italic"><ItalicIcon /></ToggleGroupItem>
              <ToggleGroupItem value="underline" aria-label="underline"><UnderlineIcon /></ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Toggle Group (multiple)">
            <ToggleGroup type="multiple" variant="outline">
              <ToggleGroupItem value="bold">B</ToggleGroupItem>
              <ToggleGroupItem value="italic">I</ToggleGroupItem>
              <ToggleGroupItem value="underline">U</ToggleGroupItem>
            </ToggleGroup>
          </Row>
        </Section>

        <Section id="avatar" title="Avatar">
          <Row label="مقاسات">
            <Avatar className="size-8"><AvatarFallback>ND</AvatarFallback></Avatar>
            <Avatar><AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" /><AvatarFallback>SC</AvatarFallback></Avatar>
            <Avatar className="size-12"><AvatarFallback><UserIcon /></AvatarFallback></Avatar>
            <Avatar className="size-16"><AvatarImage src="https://github.com/vercel.png" alt="vercel" /><AvatarFallback>VC</AvatarFallback></Avatar>
          </Row>
        </Section>

        <Section id="alert" title="Alert">
          <Alert>
            <InfoIcon />
            <AlertTitle>للعلم</AlertTitle>
            <AlertDescription>هذه رسالة معلوماتية افتراضية.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>حدث خطأ</AlertTitle>
            <AlertDescription>تعذّر إكمال العملية، حاول مرة أخرى.</AlertDescription>
            <AlertAction><Button size="sm" variant="outline">إعادة المحاولة</Button></AlertAction>
          </Alert>
        </Section>

        <Section id="empty" title="Empty">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>لا توجد رسائل</EmptyTitle>
              <EmptyDescription>عندما يصلك بريد جديد سيظهر هنا.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Button><PlusIcon />إنشاء رسالة</Button></EmptyContent>
          </Empty>
        </Section>

        <Section id="item" title="Item">
          <ItemGroup>
            <Item>
              <ItemMedia><FolderIcon /></ItemMedia>
              <ItemContent><ItemTitle>المستندات</ItemTitle><ItemDescription>12 ملف</ItemDescription></ItemContent>
              <ItemActions><Button size="icon-sm" variant="ghost" aria-label="more"><MoreHorizontalIcon /></Button></ItemActions>
            </Item>
            <ItemSeparator />
            <Item variant="muted">
              <ItemMedia variant="icon"><FileIcon /></ItemMedia>
              <ItemContent><ItemTitle>تقرير.pdf</ItemTitle><ItemDescription>2.3 ميجا</ItemDescription></ItemContent>
              <ItemActions><Badge variant="secondary">جديد</Badge></ItemActions>
            </Item>
            <ItemSeparator />
            <Item variant="outline">
              <ItemMedia><Avatar><AvatarFallback>أم</AvatarFallback></Avatar></ItemMedia>
              <ItemContent><ItemTitle>أحمد محمود</ItemTitle><ItemDescription>أرسل لك رسالة جديدة</ItemDescription></ItemContent>
              <ItemActions><Button size="sm" variant="outline">عرض</Button></ItemActions>
            </Item>
          </ItemGroup>
        </Section>

        <Section id="tabs" title="Tabs">
          <Tabs defaultValue="account" className="w-full max-w-lg">
            <TabsList>
              <TabsTrigger value="account"><UserIcon /> الحساب</TabsTrigger>
              <TabsTrigger value="password"><SettingsIcon /> كلمة السر</TabsTrigger>
              <TabsTrigger value="billing"><CreditCardIcon /> الفواتير</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="mt-3"><p className="text-muted-foreground text-sm">إعدادات حسابك تظهر هنا.</p></TabsContent>
            <TabsContent value="password" className="mt-3"><p className="text-muted-foreground text-sm">قم بتغيير كلمة السر.</p></TabsContent>
            <TabsContent value="billing" className="mt-3"><p className="text-muted-foreground text-sm">طرق الدفع والفواتير.</p></TabsContent>
          </Tabs>
        </Section>

        <Section id="table" title="Table">
          <Table>
            <TableCaption>قائمة الفواتير الأخيرة.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">رقم الفاتورة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الطريقة</TableHead>
                <TableHead className="text-end">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-medium">INV001</TableCell><TableCell><Badge>مدفوع</Badge></TableCell><TableCell>بطاقة ائتمان</TableCell><TableCell className="text-end">$250.00</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">INV002</TableCell><TableCell><Badge variant="secondary">معلّق</Badge></TableCell><TableCell>تحويل بنكي</TableCell><TableCell className="text-end">$150.00</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">INV003</TableCell><TableCell><Badge variant="destructive">ملغي</Badge></TableCell><TableCell>PayPal</TableCell><TableCell className="text-end">$80.00</TableCell></TableRow>
            </TableBody>
            <TableFooter>
              <TableRow><TableCell colSpan={3}>الإجمالي</TableCell><TableCell className="text-end">$480.00</TableCell></TableRow>
            </TableFooter>
          </Table>
        </Section>

        <Section id="accordion" title="Accordion">
          <Accordion type="single" collapsible className="w-full max-w-lg">
            <AccordionItem value="a"><AccordionTrigger>هل المشروع متاح؟</AccordionTrigger><AccordionContent>نعم، متاح ومجاني.</AccordionContent></AccordionItem>
            <AccordionItem value="b"><AccordionTrigger>هل يدعم RTL؟</AccordionTrigger><AccordionContent>نعم، عبر DirectionProvider بشكل كامل.</AccordionContent></AccordionItem>
            <AccordionItem value="c"><AccordionTrigger>هل يدعم Dark Mode؟</AccordionTrigger><AccordionContent>اضغط حرف d على الكيبورد للتبديل.</AccordionContent></AccordionItem>
          </Accordion>
        </Section>

        <Section id="collapsible" title="Collapsible">
          <Collapsible className="w-full max-w-lg">
            <CollapsibleTrigger asChild>
              <Button variant="outline"><ChevronRightIcon className="rtl:rotate-180" />اضغط لإظهار المزيد</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border-border rounded-md border p-3 text-sm">محتوى مخفي يظهر عند الضغط.</div>
            </CollapsibleContent>
          </Collapsible>
        </Section>

        <Section id="overlays" title="Dialog / Sheet / AlertDialog">
          <Row label="Dialog">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">فتح Dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>تأكيد العملية</DialogTitle><DialogDescription>هل أنت متأكد من المتابعة؟</DialogDescription></DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">إلغاء</Button></DialogClose>
                  <Button>متابعة</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
          <Row label="Sheet">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">فتح Sheet (يمين)</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>الإعدادات</SheetTitle><SheetDescription>قم بتعديل تفضيلاتك من هنا.</SheetDescription></SheetHeader>
                <div className="p-4">محتوى الـ Sheet</div>
                <SheetFooter><Button>حفظ</Button></SheetFooter>
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">فتح Sheet (يسار)</Button></SheetTrigger>
              <SheetContent side="left"><SheetHeader><SheetTitle>قائمة جانبية</SheetTitle></SheetHeader></SheetContent>
            </Sheet>
          </Row>
          <Row label="Alert Dialog">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive"><TrashIcon /> حذف</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction>حذف</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </Section>

        <Section id="popover-tooltip" title="Popover / HoverCard / Tooltip">
          <Row label="Popover">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><PaletteIcon /> الألوان</Button></PopoverTrigger>
              <PopoverContent className="w-60">
                <div className="space-y-2"><p className="font-medium text-sm">إعدادات اللون</p><p className="text-muted-foreground text-xs">محتوى يظهر داخل Popover.</p></div>
              </PopoverContent>
            </Popover>
          </Row>
          <Row label="Hover Card">
            <HoverCard>
              <HoverCardTrigger asChild><Button variant="link">@shadcn</Button></HoverCardTrigger>
              <HoverCardContent className="w-72">
                <div className="flex gap-3">
                  <Avatar><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>SC</AvatarFallback></Avatar>
                  <div><p className="text-sm font-semibold">@shadcn</p><p className="text-muted-foreground text-xs">منشئ shadcn/ui.</p></div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </Row>
          <Row label="Tooltip">
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="copy"><CopyIcon /></Button></TooltipTrigger><TooltipContent>نسخ</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="favorite"><HeartIcon /></Button></TooltipTrigger><TooltipContent>إضافة للمفضلة</TooltipContent></Tooltip>
          </Row>
        </Section>

        <Section id="dropdown-menu" title="Dropdown Menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">خيارات <ChevronRightIcon className="rtl:rotate-180" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>حسابي</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem><UserIcon /> الملف الشخصي<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem><SettingsIcon /> الإعدادات<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive"><LogOutIcon /> تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section id="breadcrumb-pagination" title="Breadcrumb / Pagination">
          <Row label="Breadcrumb">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#">الرئيسية</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href="#">الإعدادات</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>الحساب</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Row>
          <Row label="Pagination">
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>
                <PaginationItem><PaginationLink href="#" isActive>2</PaginationLink></PaginationItem>
                <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
                <PaginationItem><PaginationEllipsis /></PaginationItem>
                <PaginationItem><PaginationNext href="#" /></PaginationItem>
              </PaginationContent>
            </Pagination>
          </Row>
        </Section>

        <Section id="card" title="Card">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>عنوان البطاقة</CardTitle>
                <CardDescription>وصف بسيط للبطاقة.</CardDescription>
                <CardAction><Button size="icon-sm" variant="ghost" aria-label="more"><MoreHorizontalIcon /></Button></CardAction>
              </CardHeader>
              <CardContent><p className="text-sm">محتوى البطاقة الأساسي.</p></CardContent>
              <CardFooter className="gap-2"><Button>تأكيد</Button><Button variant="outline">إلغاء</Button></CardFooter>
            </Card>
            <Card>
              <CardHeader><CardTitle>إحصائيات</CardTitle><CardDescription>هذا الشهر</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm">الزوار</span><Badge>12,453</Badge></div>
                <Progress value={68} />
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="calendar" title="Calendar">
          <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
        </Section>

        <Section id="layout" title="Aspect Ratio / Scroll Area / Separator">
          <Row label="Aspect Ratio (16:9)">
            <div className="w-full max-w-md">
              <AspectRatio ratio={16 / 9} className="bg-muted flex items-center justify-center rounded-md">
                <ImageIcon className="text-muted-foreground size-8" />
              </AspectRatio>
            </div>
          </Row>
          <Row label="Separator">
            <div className="w-full max-w-md">
              <p className="text-sm">قبل الفاصل</p>
              <Separator className="my-3" />
              <p className="text-sm">بعد الفاصل</p>
            </div>
          </Row>
          <Row label="Scroll Area">
            <ScrollArea className="border-border h-40 w-full max-w-md rounded-md border p-3">
              <div className="space-y-2">
                {Array.from({ length: 20 }).map((_, i) => (
                  <p key={i} className="text-sm">عنصر رقم {i + 1} داخل scroll area قابل للتمرير.</p>
                ))}
              </div>
            </ScrollArea>
          </Row>
        </Section>

        <Section id="loading" title="Skeleton / Spinner">
          <Row label="Skeleton">
            <div className="flex w-full max-w-md items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
            </div>
          </Row>
          <Row label="Spinner">
            <Spinner className="size-4" />
            <Spinner className="size-6" />
            <Spinner className="size-8" />
          </Row>
        </Section>

        <Section id="kbd" title="Kbd">
          <Row label="مفاتيح">
            <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
            <KbdGroup><Kbd>Ctrl</Kbd><span className="text-muted-foreground text-xs">+</span><Kbd>Shift</Kbd><span className="text-muted-foreground text-xs">+</span><Kbd>P</Kbd></KbdGroup>
            <Kbd>Esc</Kbd>
          </Row>
        </Section>

        <Section id="sonner" title="Sonner (Toast)">
          <Row label="إظهار توست">
            <Button onClick={() => toast("تم بنجاح", { description: "هذا توست افتراضي." })}>توست عادي</Button>
            <Button variant="secondary" onClick={() => toast.success("تم الحفظ بنجاح")}>نجاح</Button>
            <Button variant="destructive" onClick={() => toast.error("حدث خطأ", { description: "حاول مرة أخرى." })}>خطأ</Button>
            <Button variant="outline" onClick={() => toast("هل تريد التراجع؟", { action: { label: "تراجع", onClick: () => toast("تم التراجع") } })}>مع زر إجراء</Button>
          </Row>
        </Section>

        <Section id="icons" title="عيّنة من lucide-react">
          <Row label="أيقونات شائعة">
            {[HomeIcon, UserIcon, UsersIcon, SettingsIcon, BellIcon, SearchIcon, MailIcon, CalendarIcon, StarIcon, HeartIcon, FileIcon, FolderIcon, ImageIcon, CreditCardIcon, LayoutDashboardIcon, ArrowRightIcon].map((Icon, i) => (
              <div key={i} className="border-border bg-muted/30 flex size-10 items-center justify-center rounded-md border">
                <Icon className="size-4" />
              </div>
            ))}
          </Row>
        </Section>
      </div>
    </div>
  )
}

export default ThemePage
