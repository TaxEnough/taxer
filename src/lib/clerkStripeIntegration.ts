import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";

// Subscription durumlarını temsil eden tipler
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused' | null;
export type PlanType = 'basic' | 'premium' | 'free';

// Abonelik bilgilerini temsil eden interface
export interface SubscriptionData {
  status: SubscriptionStatus;
  planType: PlanType;
  currentPeriodEnd?: Date;
  subscriptionId?: string;
}

/**
 * Kullanıcının abonelik durumunu Clerk meta verilerinden alır
 */
export async function getUserSubscription(userId?: string): Promise<SubscriptionData> {
  // Eğer userId sağlanmadıysa, mevcut kullanıcıyı al
  if (!userId) {
    const session = await auth();
    if (!session?.userId) {
      return { status: null, planType: 'free' };
    }
    userId = session.userId;
  }

  try {
    // Clerk'ten kullanıcı bilgilerini al
    const user = await clerkClient.users.getUser(userId);
    
    // Kullanıcının public ve private meta verilerini kontrol et
    const subscription = user.privateMetadata.subscription as any || user.publicMetadata.subscription as any;
    
    // Abonelik durumunu döndür
    if (subscription && subscription.status === 'active') {
      return {
        status: 'active',
        planType: subscription.plan || 'premium',
        currentPeriodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : undefined,
        subscriptionId: subscription.id
      };
    }
    
    // Abonelik aktif değilse veya yoksa
    return {
      status: subscription?.status || null,
      planType: 'free',
      subscriptionId: subscription?.id
    };
  } catch (error) {
    console.error("Error getting user subscription from Clerk:", error);
    return { status: null, planType: 'free' };
  }
}

/**
 * Kullanıcının abonelik durumunu günceller
 */
export async function updateUserSubscription(
  userId: string, 
  subscriptionData: {
    status: SubscriptionStatus;
    plan: PlanType;
    id: string;
    currentPeriodEnd?: Date | number;
  }
): Promise<boolean> {
  try {
    // Kullanıcı meta verilerini güncelle
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        subscription: {
          status: subscriptionData.status,
          plan: subscriptionData.plan,
          id: subscriptionData.id,
          currentPeriodEnd: subscriptionData.currentPeriodEnd
        }
      }
    });
    return true;
  } catch (error) {
    console.error("Error updating user subscription in Clerk:", error);
    return false;
  }
}

/**
 * Kullanıcının premium özelliklere erişim hakkı olup olmadığını kontrol eder
 */
export async function hasUserPremiumAccess(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  
  // Kullanıcının meta verilerini kontrol et
  const subscription = user.privateMetadata.subscription as any || user.publicMetadata.subscription as any;
  
  // Aktif bir abonelik varsa true döndür
  return subscription && subscription.status === 'active';
}

/**
 * Kullanıcının abonelik planını kontrol eder (basic veya premium)
 */
export async function getUserPlanType(): Promise<PlanType> {
  const user = await currentUser();
  if (!user) return 'free';
  
  // Kullanıcının meta verilerini kontrol et
  const subscription = user.privateMetadata.subscription as any || user.publicMetadata.subscription as any;
  
  // Aktif bir abonelik varsa plan tipini döndür, yoksa free
  if (subscription && subscription.status === 'active') {
    return subscription.plan || 'premium';
  }
  
  return 'free';
} 