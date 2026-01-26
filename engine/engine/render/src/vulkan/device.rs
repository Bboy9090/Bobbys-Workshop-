// Vulkan Device Bootstrap - Explicit, No Magic
// Part of The Forge Doctrine: Control Over Convenience

use ash::vk;
use std::ffi::CString;
use crate::error::{RenderError, Result};

pub struct VulkanDevice {
    pub instance: ash::Instance,
    pub physical_device: vk::PhysicalDevice,
    pub device: ash::Device,
    pub queue: vk::Queue,
    pub queue_family_index: u32,
}

impl VulkanDevice {
    /// Create Vulkan instance with explicit requirements
    pub fn create_instance(entry: &ash::Entry) -> Result<ash::Instance> {
        let app_name = CString::new("ForgeEngine").unwrap();
        let engine_name = CString::new("Forge").unwrap();

        let app_info = vk::ApplicationInfo::builder()
            .application_name(&app_name)
            .application_version(vk::make_api_version(0, 1, 0, 0))
            .engine_name(&engine_name)
            .engine_version(vk::make_api_version(0, 1, 0, 0))
            .api_version(vk::API_VERSION_1_3);

        // Required extensions (explicit, no guessing)
        let mut extensions = vec![
            ash::extensions::khr::Surface::name().as_ptr(),
        ];
        
        #[cfg(target_os = "macos")]
        extensions.push(ash::extensions::mvk::MacOSSurface::name().as_ptr());
        #[cfg(target_os = "windows")]
        extensions.push(ash::extensions::khr::Win32Surface::name().as_ptr());
        #[cfg(target_os = "linux")]
        extensions.push(ash::extensions::khr::XlibSurface::name().as_ptr());

        let mut create_info = vk::InstanceCreateInfo::builder()
            .application_info(&app_info)
            .enabled_extension_names(&extensions);

        #[cfg(debug_assertions)]
        {
            let layers = vec![CString::new("VK_LAYER_KHRONOS_validation").unwrap()];
            let layer_names: Vec<*const i8> = layers.iter().map(|l| l.as_ptr()).collect();
            create_info = create_info.enabled_layer_names(&layer_names);
        }

        unsafe { entry.create_instance(&create_info, None) }
            .map_err(|e| RenderError::DeviceInit(format!("Instance creation: {:?}", e)))
    }

    /// Select physical device with hard requirements
    pub fn select_physical_device(instance: &ash::Instance) -> Result<vk::PhysicalDevice> {
        let devices = unsafe { instance.enumerate_physical_devices() }
            .map_err(|e| RenderError::DeviceInit(format!("Enumerate devices: {:?}", e)))?;

        for device in devices {
            let props = unsafe { instance.get_physical_device_properties(*device) };
            
            // Hard requirements (non-negotiable)
            if props.api_version < vk::make_api_version(0, 1, 3, 0) {
                continue;
            }

            // Check for required features (simplified for now)
            // Full feature checking would use get_physical_device_features2
            return Ok(*device);
        }

        Err(RenderError::DeviceInit("No suitable GPU found".into()))
    }

    /// Create logical device with one queue family
    pub fn create_logical_device(
        instance: &ash::Instance,
        physical_device: vk::PhysicalDevice,
    ) -> Result<(ash::Device, vk::Queue, u32)> {
        let queue_families = unsafe { instance.get_physical_device_queue_family_properties(physical_device) };
        
        let graphics_family = queue_families
            .iter()
            .position(|qf| qf.queue_flags.contains(vk::QueueFlags::GRAPHICS))
            .ok_or_else(|| RenderError::DeviceInit("No graphics queue family".into()))?;

        let queue_priorities = [1.0f32];
        let queue_info = vk::DeviceQueueCreateInfo::builder()
            .queue_family_index(graphics_family as u32)
            .queue_priorities(&queue_priorities);

        let features = vk::PhysicalDeviceFeatures::builder();

        let device_create_info = vk::DeviceCreateInfo::builder()
            .queue_create_infos(std::slice::from_ref(&queue_info))
            .enabled_features(&features);

        let device = unsafe { instance.create_device(physical_device, &device_create_info, None) }
            .map_err(|e| RenderError::DeviceInit(format!("Device creation: {:?}", e)))?;

        let queue = unsafe { device.get_device_queue(graphics_family as u32, 0) };

        Ok((device, queue, graphics_family as u32))
    }
}
