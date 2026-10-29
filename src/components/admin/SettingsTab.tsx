'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WifiOff, RefreshCw, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getOfflineQueue, manualSync, removeFromQueue, type PendingAttendance } from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

interface Device {
  id: string
  student_id: string
  fingerprint?: string | null
  device_fingerprint?: string | null
  registered_at: string | null
  last_used: string | null
  student_name?: string
  students?: {
    first_name?: string | null
    last_name?: string | null
  }
}

export default function SettingsTab() {
  const [offlineQueue, setOfflineQueue] = useState<PendingAttendance[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)

  // جلب الأجهزة المسجلة
  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const admin = await supabase.auth.getSession().then(async ({ data: { session } }) => {
         if (!session?.user?.id) return null;
         const { data } = await supabase.from('admins').select('*').eq('auth_user_id', session.user.id).single();
         return data;
      });

      let query = supabase
        .from('student_devices')
        .select(`
          *,
          students!inner(first_name, last_name)
        `)
        .order('last_used', { ascending: false });

      if (admin && admin.role !== 'super_admin' && admin.institution_id) {
        query = query.eq('institution_id', admin.institution_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // جلب الحضور المعلق
  useEffect(() => {
    setOfflineQueue(getOfflineQueue())
  }, [])

  // مزامنة يدوية
  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      const res = await manualSync()
      setOfflineQueue(getOfflineQueue())
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('حدث خطأ في المزامنة')
    } finally {
      setIsSyncing(false)
    }
  }

  // حذف جهاز
  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الجهاز؟')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('student_devices')
        .delete()
        .eq('id', deviceId)

      if (error) throw error
      toast.success('تم حذف الجهاز بنجاح')
      // إعادة جلب الأجهزة
      window.location.reload()
    } catch {
      toast.error('فشل في حذف الجهاز')
    } finally {
      setLoading(false)
    }
  }

  // حذف عنصر من الطابور
  const handleDeleteQueueItem = (index: number) => {
    if (confirm('هل تريد حذف هذا الحضور المعلق؟')) {
      removeFromQueue(index)
      setOfflineQueue(getOfflineQueue())
      toast.success('تم الحذف')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">إدارة الأجهزة</TabsTrigger>
          <TabsTrigger value="offline">الحضور المعلق</TabsTrigger>
          <TabsTrigger value="general">عام</TabsTrigger>
        </TabsList>

        {/* ✅ تبويب إدارة الأجهزة */}
        <TabsContent value="devices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>الأجهزة المسجلة ({devicesData?.length || 0})</CardTitle>
              <CardDescription>
                إدارة أجهزة الطلاب المسجلة في النظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الطالب</TableHead>
                      <TableHead>بصمة الجهاز</TableHead>
                      <TableHead>مسجل في</TableHead>
                      <TableHead>آخر استخدام</TableHead>
                      <TableHead>حالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicesData?.map((device: Device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          {device.students?.first_name} {device.students?.last_name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {(device.device_fingerprint || device.fingerprint)?.slice(0, 16)}...
                        </TableCell>
                        <TableCell>{device.registered_at ? new Date(device.registered_at).toLocaleDateString('ar-DZ') : 'غير مسجل'}</TableCell>
                        <TableCell>{device.last_used ? new Date(device.last_used).toLocaleString('ar-DZ') : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={device.registered_at ? "default" : "secondary"}>
                            {device.registered_at ? <><CheckCircle className="w-3 h-3 mr-1"/> مسجل</> : <><XCircle className="w-3 h-3 mr-1"/> غير مسجل</>}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteDevice(device.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4"/>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ✅ تبويب الحضور المعلق */}
        <TabsContent value="offline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>الحضور المعلق ({offlineQueue.length})</CardTitle>
              <CardDescription>
                هذه الحضورات محفوظة محلياً وتنتظر الإرسال عند توفر الإنترنت
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offlineQueue.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  لا يوجد حضورات معلقة حالياً ✅
                </p>
              ) : (
                <div className="space-y-3">
                  {offlineQueue.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                      <div>
                        <p className="font-medium">طالب: {item.studentNumber}</p>
                        <p className="text-sm text-muted-foreground">جلسة: {item.sessionCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString('ar-DZ')}
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteQueueItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button 
                    onClick={handleManualSync} 
                    disabled={isSyncing}
                    className="w-full mt-4"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 mr-2" />
                        إرسال الكل ({offlineQueue.length})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الإعدادات العامة */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات عامة</CardTitle>
              <CardDescription>إعدادات النظام العامة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>مدة صلاحية كود الجلسة (دقائق)</Label>
                <Input placeholder="30" type="number" />
              </div>
              <div className="space-y-2">
                <Label>السماح بالتسجيل أوفلاين</Label>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="offline" className="w-4 h-4 rounded" />
                  <label htmlFor="offline" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    السماح للطلاب بحفظ الحضور محلياً
                  </label>
                </div>
              </div>
              <Button className="w-full">حفظ الإعدادات</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
