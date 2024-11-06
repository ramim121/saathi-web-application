import MainLayout from '@/layouts/MainLayout';

function ManualNotification() {

    return (
        <div>
            ManualNotification
        </div>
    )
}

export default ManualNotification;

ManualNotification.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}